import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/features/history/history_controller.dart';
import 'package:nolleoon_mobile/features/history/history_repository.dart';
import 'package:nolleoon_mobile/features/history/history_summary.dart';
import 'package:nolleoon_mobile/data/wire_models.dart';

Map<String, Object?> record(
  String id, {
  Object? game,
  String type = 'team',
  String status = 'completed',
}) => {
  'runId': id,
  'roomId': 'room-a',
  'type': type,
  'status': status,
  'version': 2,
  'facilitatorMembershipId': 'm-a',
  'selectedMembershipIds': ['m-a', 'm-b'],
  'createdAt': 1000,
  'startedAt': 1100,
  'endedAt': 1200,
  'isParticipant': true,
  'game':
      game ??
      {
        'kind': 'team',
        'teamCount': 2,
        'assignments': [
          {'membershipId': 'm-a', 'team': 1},
          {'membershipId': 'm-b', 'team': 2},
        ],
      },
};

class HistoryTransport implements ApiTransport {
  final requests = <TransportRequest>[];
  late Future<TransportResponse> Function(TransportRequest) handler;
  @override
  Future<TransportResponse> send(TransportRequest r, CancellationToken c) {
    requests.add(r);
    return handler(r);
  }
}

TransportResponse response(Object value) =>
    TransportResponse(200, jsonEncode(value));
void main() {
  late HistoryTransport transport;
  late HistoryController controller;
  late HistoryRepository repository;
  setUp(() {
    transport = HistoryTransport();
    repository = HistoryRepository(
      ApiClient(
        transport: transport,
        resolver: const NativeRoutes(),
        accessToken: () async => 'synthetic',
      ),
    );
    controller = HistoryController(repository, 'room-a');
  });
  tearDown(() => controller.dispose());
  test('server pages use opaque cursor, deduplicate records and never send mutations', () async {
    transport.handler = (r) async => response({
      'items': [record('run-a')],
      'nextCursor': r.uri.query.isEmpty ? 'opaque_cursor' : null,
    });
    await controller.refresh();
    await controller.more();
    expect(controller.items.length, 1);
    expect(controller.nextCursor, isNull);
    expect(
      transport.requests.last.uri.queryParameters['cursor'],
      'opaque_cursor',
    );
    expect(transport.requests.every((r) => r.method == 'GET'), true);
  });
  test('repeated cursor is an error, not an endless next page', () async {
    transport.handler = (_) async => response({
      'items': [record('run-a')],
      'nextCursor': 'same',
    });
    await controller.refresh();
    await controller.more();
    expect(controller.error, isNotNull);
    expect(controller.items.length, 1);
  });
  test('forbidden removes cached private list and detail', () async {
    transport.handler = (r) async => response(
      r.uri.path.endsWith('/history')
          ? {
              'items': [record('run-a')],
              'nextCursor': null,
            }
          : record('run-a'),
    );
    await controller.refresh();
    await controller.select('run-a');
    transport.handler = (_) async => const TransportResponse(403, '{}');
    await controller.refresh();
    expect(controller.items, isEmpty);
    expect(controller.detail, isNull);
  });
  test(
    'background and disposed old response cannot restore private state',
    () async {
      final late = Completer<TransportResponse>();
      transport.handler = (_) => late.future;
      final read = controller.refresh();
      controller.setForeground(false);
      late.complete(
        response({
          'items': [record('run-a')],
          'nextCursor': null,
        }),
      );
      await read;
      expect(controller.items, isEmpty);
      expect(controller.detail, isNull);
      transport.handler = (_) async => response({
        'items': [record('run-b')],
        'nextCursor': null,
      });
      await controller.setForeground(true);
      expect(controller.items.single.runId, 'run-b');
    },
  );
  test('401 notifies authentication and stops foreground reads', () async {
    var lost = 0;
    controller.dispose();
    controller = HistoryController(
      repository,
      'room-a',
      onSessionLost: () => lost++,
    );
    transport.handler = (_) async => const TransportResponse(401, '{}');
    await controller.refresh();
    expect(lost, 1);
    expect(controller.foreground, false);
    await controller.more();
    expect(transport.requests.length, 1);
  });
  test('cross-room list or mismatched detail fails closed', () async {
    transport.handler = (_) async => response({
      'items': [
        {...record('run-a'), 'roomId': 'other'},
      ],
      'nextCursor': null,
    });
    await controller.refresh();
    expect(controller.items, isEmpty);
    expect(controller.error, isNotNull);
    transport.handler = (_) async => response(record('run-b'));
    await controller.select('run-a');
    expect(controller.detail, isNull);
  });
  test('restricted and redacted details never dump private fields or infer outcomes', () {
    final restricted = RunDto.fromJson(
      record(
        'r',
        type: 'trial',
        status: 'interrupted',
        game: {'kind': 'trial', 'restricted': true, 'phase': 'interrupted'},
      ),
    );
    expect(historyLines(restricted), ['상세 내용은 공개되지 않아요.']);
    final redacted = RunDto.fromJson({
      ...record('r', type: 'draw'),
      'facilitatorMembershipId': null,
      'selectedMembershipIds': [],
      'game': {
        'kind': 'draw',
        'redacted': true,
        'summary': {
          'participantCount': 3,
          'revealed': {'winnerCount': 1, 'notWinnerCount': 0},
        },
      },
    });
    expect(historyLines(redacted).join(' '), contains('공개된 당첨 1 · 비당첨 0'));
    expect(historyLines(redacted).join(' '), isNot(contains('미공개 당첨')));
  });
  test('incomplete draw and no-choice menu preserve server meaning', () {
    final draw = RunDto.fromJson(
      record(
        'd',
        type: 'draw',
        status: 'incomplete',
        game: {
          'kind': 'draw',
          'winnerCount': 2,
          'penaltyText': '합성',
          'revealed': [
            {'membershipId': 'm-a', 'winner': true},
          ],
          'self': {'participating': true, 'revealed': true, 'canReveal': false},
          'blockedPolicy': null,
        },
      ),
    );
    expect(historyLines(draw), contains('공개된 당첨 1 · 비당첨 0'));
    expect(historyLines(draw), contains('미공개 제비 결과는 추정하지 않아요.'));
    final menu = RunDto.fromJson(
      record(
        'm',
        type: 'menu',
        game: {
          'kind': 'menu',
          'phase': 'completed',
          'self': {
            'eligible': true,
            'submission': {'kind': 'candidate', 'menu': '비공개 후보'},
          },
          'result': {'outcome': 'no-choice'},
        },
      ),
    );
    expect(historyLines(menu), ['선택된 메뉴가 없어요.']);
  });
}
