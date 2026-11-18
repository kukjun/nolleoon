import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/features/games/game_repository.dart';
import 'package:nolleoon_mobile/features/games/game_controller.dart';

Map<String, Object?> run([int version = 1]) => {
  'runId': 'run-a',
  'roomId': 'room-a',
  'type': 'team',
  'status': 'draft',
  'version': version,
  'facilitatorMembershipId': 'member-a',
  'selectedMembershipIds': ['member-a', 'member-b'],
  'createdAt': 1000,
  'startedAt': null,
  'endedAt': null,
  'isParticipant': true,
  'game': {'kind': 'team', 'teamCount': 2, 'assignments': []},
};

class FakeTransport implements ApiTransport {
  final requests = <TransportRequest>[];
  late Future<TransportResponse> Function(TransportRequest) handler;
  @override
  Future<TransportResponse> send(TransportRequest r, CancellationToken c) {
    requests.add(r);
    return handler(r);
  }
}

TransportResponse ok(Object data) => TransportResponse(200, jsonEncode(data));
void main() {
  late FakeTransport t;
  late GameRepository repo;
  late GameController c;
  setUp(() {
    t = FakeTransport();
    repo = GameRepository(
      ApiClient(
        transport: t,
        resolver: const NativeRoutes(),
        accessToken: () async => 'synthetic',
      ),
      requestId: () => 'intent-a',
    );
    c = GameController(repo);
    t.handler = (_) async => ok(run());
  });
  tearDown(() => c.dispose());
  test('create room version and subsequent commands use exact frozen run version/body', () async {
    final selected = ['member-a', 'member-b'];
    final settings = <String, Object?>{'teamCount': 2};
    final intent = repo.create('room-a', 7, 'team', selected, settings);
    selected.clear();
    settings['teamCount'] = 9;
    await repo.send(intent);
    final body = jsonDecode(t.requests.single.body!);
    expect(body, {
      'requestId': 'intent-a',
      'expectedVersion': 7,
      'type': 'team',
      'selectedMembershipIds': ['member-a', 'member-b'],
      'settings': {'teamCount': 2},
    });
    expect(t.requests.single.uri.path, '/api/native/travel-rooms/room-a/runs');
    for (final op in [
      ApiOperation.editRun,
      ApiOperation.startRun,
      ApiOperation.cancelRun,
      ApiOperation.runAction,
    ]) {
      final i = repo.command(
        op,
        'room-a',
        'run-a',
        3,
        selected: ['member-a'],
        settings: {'teamCount': 2},
        command: {'kind': 'reveal'},
      );
      await repo.send(i);
      expect(jsonDecode(t.requests.last.body!)['expectedVersion'], 3);
    }
  });
  test('network retry reuses bytes, never automatically submits, conflict refreshes only', () async {
    await c.open('room-a', 'run-a');
    var fail = true;
    t.handler = (r) async {
      if (r.method != 'GET' && fail) {
        throw const ApiFailure(FailureKind.network);
      }
      return ok(run(2));
    };
    await c.submit(repo.command(ApiOperation.startRun, 'room-a', 'run-a', 1));
    expect(c.hasPendingIntent, true);
    final bytes = t.requests.last.body;
    await c.refresh();
    expect(t.requests.where((r) => r.method == 'POST').length, 1);
    fail = false;
    await c.retry();
    expect(t.requests.last.body, bytes);
    expect(c.run!.version, 2);
    t.handler = (r) async => r.method == 'GET'
        ? ok(run(4))
        : const TransportResponse(409, '{"error":{"code":"STATE_CONFLICT"}}');
    await c.submit(repo.command(ApiOperation.startRun, 'room-a', 'run-a', 2));
    expect(c.run!.version, 4);
    expect(c.hasPendingIntent, false);
    expect(t.requests.last.method, 'GET');
  });
  test(
    'background cancels late response and private state; resume only GET',
    () async {
      await c.open('room-a', 'run-a');
      final late = Completer<TransportResponse>();
      t.handler = (_) => late.future;
      final pending = c.refresh();
      c.setForeground(false);
      expect(c.run, isNull);
      expect(c.hasPendingIntent, false);
      late.complete(ok(run(9)));
      await pending;
      expect(c.run, isNull);
      t.handler = (_) async => ok(run(10));
      c.setForeground(true);
      await Future<void>.delayed(Duration.zero);
      expect(c.run!.version, 10);
      expect(t.requests.last.method, 'GET');
    },
  );
  test('new route invalidates older response and unauthorized clears identity scoped state', () async {
    final late = Completer<TransportResponse>();
    t.handler = (_) => late.future;
    final old = c.open('room-a', 'run-a');
    t.handler = (_) async => ok({...run(2), 'runId': 'run-b'});
    await c.open('room-a', 'run-b');
    late.complete(ok(run(8)));
    await old;
    expect(c.run!.runId, 'run-b');
    var lost = 0;
    c.dispose();
    c = GameController(repo, onSessionLost: () => lost++);
    await c.open('room-a', 'run-b');
    t.handler = (_) async =>
        const TransportResponse(401, '{"error":{"code":"UNAUTHENTICATED"}}');
    await c.refresh();
    expect(c.run, isNull);
    expect(lost, 1);
    expect(c.foreground, false);
  });
  test('one active game conflict follows server room pointer without recreating a run', () async {
    final room = <String, Object?>{
      'roomId': 'room-a',
      'title': '합성 여행',
      'startDate': null,
      'endDate': null,
      'status': 'open',
      'version': 4,
      'self': {'membershipId': 'member-a', 'isAdmin': true},
      'members': <Object?>[],
      'activeRun': null,
    };
    t.handler = (_) async => ok(room);
    await c.open('room-a', null);
    room['activeRun'] = {
      'runId': 'run-a',
      'type': 'team',
      'status': 'draft',
      'facilitatorMembershipId': 'member-a',
    };
    t.handler = (r) async {
      if (r.method == 'POST') {
        return const TransportResponse(
          409,
          '{"error":{"code":"STATE_CONFLICT"}}',
        );
      }
      return ok(r.uri.path.endsWith('/runs/run-a') ? run() : room);
    };
    await c.submit(
      repo.create(
        'room-a',
        4,
        'team',
        ['member-a', 'member-b'],
        {'teamCount': 2},
      ),
    );
    expect(c.run!.runId, 'run-a');
    expect(c.hasPendingIntent, false);
    expect(t.requests.where((r) => r.method == 'POST').length, 1);
  });
  test('duplicate tap cannot replace in-flight intent; forbidden erases private state', () async {
    await c.open('room-a', 'run-a');
    final response = Completer<TransportResponse>();
    t.handler = (_) => response.future;
    final first = c.submit(
      repo.command(ApiOperation.startRun, 'room-a', 'run-a', 1),
    );
    await Future<void>.delayed(Duration.zero);
    await c.submit(repo.command(ApiOperation.cancelRun, 'room-a', 'run-a', 1));
    expect(t.requests.where((r) => r.method == 'POST').length, 1);
    response.complete(
      const TransportResponse(403, '{"error":{"code":"FORBIDDEN"}}'),
    );
    await first;
    expect(c.run, isNull);
    expect(c.hasPendingIntent, false);
  });
  testWidgets(
    'setup room polls at 10 seconds until a server active run exists',
    (tester) async {
      t.handler = (_) async => ok({
        'roomId': 'room-a',
        'title': '합성',
        'startDate': null,
        'endDate': null,
        'status': 'open',
        'version': 0,
        'self': {'membershipId': 'member-a', 'isAdmin': true},
        'members': <Object?>[],
        'activeRun': null,
      });
      await c.open('room-a', null);
      await tester.pump(const Duration(milliseconds: 9999));
      expect(t.requests.length, 1);
      await tester.pump(const Duration(milliseconds: 1));
      await tester.pump();
      expect(t.requests.length, 2);
      await c.setForeground(false);
    },
  );
  testWidgets(
    'foreground polls at 2.5s, background never polls or replays commands',
    (tester) async {
      await c.open('room-a', 'run-a');
      expect(t.requests.length, 1);
      await tester.pump(const Duration(milliseconds: 2499));
      expect(t.requests.length, 1);
      await tester.pump(const Duration(milliseconds: 1));
      await tester.pump();
      expect(t.requests.length, 2);
      c.setForeground(false);
      await tester.pump(const Duration(seconds: 20));
      expect(t.requests.length, 2);
      await c.setForeground(false);
    },
  );
}
