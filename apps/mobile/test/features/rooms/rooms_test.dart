import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/features/rooms/rooms_repository.dart';
import 'package:nolleoon_mobile/features/rooms/rooms_controller.dart';

Map<String, Object?> room([String id = 'room-a']) => {
  'roomId': id,
  'title': '합성 여행',
  'startDate': null,
  'endDate': null,
  'status': 'open',
  'version': 1,
  'self': {'membershipId': 'member-a', 'isAdmin': true},
  'members': [
    {
      'membershipId': 'member-a',
      'nickname': '여행자',
      'presetId': 'preset-01',
      'connected': true,
      'isAdmin': true,
    },
  ],
  'activeRun': null,
};
Map<String, Object?> page(String id, String? cursor) => {
  'items': [
    {
      'roomId': id,
      'title': '합성 여행',
      'startDate': null,
      'endDate': null,
      'status': 'open',
      'version': 1,
      'isAdmin': true,
      'memberCount': 1,
    },
  ],
  'nextCursor': cursor,
};

class FakeTransport implements ApiTransport {
  final requests = <TransportRequest>[];
  final cancels = <CancellationToken>[];
  late Future<TransportResponse> Function(TransportRequest) handler;
  @override
  Future<TransportResponse> send(TransportRequest r, CancellationToken c) {
    requests.add(r);
    cancels.add(c);
    return handler(r);
  }
}

TransportResponse ok(Object x) => TransportResponse(200, jsonEncode(x));
void main() {
  late FakeTransport t;
  late RoomsController c;
  setUp(() {
    t = FakeTransport();
    c = RoomsController(
      RoomsRepository(
        ApiClient(
          transport: t,
          resolver: const NativeRoutes(),
          accessToken: () async => 'synthetic',
        ),
        requestId: () => 'request-a',
      ),
    );
  });
  tearDown(() => c.dispose());
  test('pagination uses cursor and deduplicates memberships', () async {
    t.handler = (r) async =>
        ok(page('room-a', r.uri.query.isEmpty ? 'cursor-a' : null));
    await c.refresh();
    await c.loadMore();
    expect(c.items.length, 1);
    expect(c.nextCursor, null);
    expect(t.requests.last.uri.queryParameters, {'cursor': 'cursor-a'});
  });
  test(
    'lost create response retains exact intent and suppresses double tap',
    () async {
      t.handler = (r) async => throw const ApiFailure(FailureKind.network);
      await c.create('합성 여행', null, null);
      expect(c.pendingCreate, isTrue);
      final first = t.requests.single.body;
      expect(jsonDecode(first!), {
        'requestId': 'request-a',
        'title': '합성 여행',
        'startDate': null,
        'endDate': null,
      });
      expect(t.requests.single.uri.path, '/api/native/travel-rooms');
      final pending = Completer<TransportResponse>();
      t.handler = (r) => pending.future;
      final retry = c.create('다른 이름', null, null);
      await Future<void>.delayed(Duration.zero);
      await c.create('다른 이름', null, null);
      expect(t.requests.length, 2);
      pending.complete(ok(room()));
      await retry;
      expect(t.requests.last.body, first);
      expect(c.room?.roomId, 'room-a');
    },
  );
  test(
    'background cancels read and removes protected data; resume reloads',
    () async {
      t.handler = (r) async => ok(room());
      await c.open('room-a');
      expect(c.room, isNotNull);
      final pending = Completer<TransportResponse>();
      t.handler = (r) => pending.future;
      final read = c.refresh();
      await Future<void>.delayed(Duration.zero);
      c.setForeground(false);
      expect(c.room, isNull);
      expect(c.items, isEmpty);
      await Future<void>.delayed(Duration.zero);
      expect(t.cancels.last.isCancelled, isTrue);
      pending.complete(ok(room()));
      await read;
      expect(c.room, isNull);
      t.handler = (r) async => ok(room());
      c.setForeground(true);
      await Future<void>.delayed(Duration.zero);
      expect(c.room, isNotNull);
    },
  );
  test(
    'permission loss clears room and list instead of retaining stale members',
    () async {
      t.handler = (r) async => ok(room());
      await c.open('room-a');
      t.handler = (r) async => const TransportResponse(
        403,
        '{"error":{"code":"FORBIDDEN","message":"private"}}',
      );
      await c.refresh();
      expect(c.room, isNull);
      expect(c.items, isEmpty);
      expect(c.error, isNotNull);
    },
  );
  test(
    'dispose cancels outstanding request and ignores later completion',
    () async {
      final pending = Completer<TransportResponse>();
      t.handler = (r) => pending.future;
      final read = c.refresh();
      await Future<void>.delayed(Duration.zero);
      c.dispose();
      pending.complete(ok(page('room-a', null)));
      await read;
      expect(c.items, isEmpty);
    },
  );
  test('server 401 drops protected state and signals auth owner', () async {
    var lost = 0;
    c.dispose();
    c = RoomsController(
      RoomsRepository(
        ApiClient(
          transport: t,
          resolver: const NativeRoutes(),
          accessToken: () async => 'synthetic',
        ),
      ),
      onSessionLost: () => lost++,
    );
    t.handler = (r) async => ok(room());
    await c.open('room-a');
    t.handler = (r) async => const TransportResponse(
      401,
      '{"error":{"code":"SESSION_REQUIRED","message":"private"}}',
    );
    await c.refresh();
    expect(c.room, isNull);
    expect(lost, 1);
  });
  test('newer room wins even when previous navigation resolves last', () async {
    final old = Completer<TransportResponse>();
    t.handler = (r) => r.uri.path.endsWith('room-a')
        ? old.future
        : Future.value(ok(room('room-b')));
    final a = c.open('room-a');
    await Future<void>.delayed(Duration.zero);
    await c.open('room-b');
    old.complete(ok(room('room-a')));
    await a;
    expect(c.room?.roomId, 'room-b');
  });
}
