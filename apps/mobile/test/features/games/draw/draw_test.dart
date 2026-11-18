import 'dart:async';
import 'dart:convert';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/data/wire_models.dart';
import 'package:nolleoon_mobile/features/games/game_controller.dart';
import 'package:nolleoon_mobile/features/games/game_repository.dart';
import 'package:nolleoon_mobile/features/games/game_screen.dart';
import 'package:nolleoon_mobile/features/games/draw/draw_game.dart';

import '../games_test.dart' show FakeTransport, ok;

Map<String, Object?> drawRun(
  int n, {
  String status = 'active',
  bool participating = true,
  bool ownRevealed = false,
  List<Map<String, Object?>> revealed = const [],
  String id = 'run-a',
}) => {
  'runId': id,
  'roomId': 'room-a',
  'type': 'draw',
  'status': status,
  'version': 4,
  'facilitatorMembershipId': 'm1',
  'selectedMembershipIds': [for (var i = 1; i <= n; i++) 'm$i'],
  'createdAt': 1000,
  'startedAt': status == 'draft' ? null : 2000,
  'endedAt': ['incomplete', 'completed'].contains(status) ? 3000 : null,
  'isParticipant': participating,
  'game': {
    'kind': 'draw',
    'winnerCount': 1,
    'penaltyText': '합성 설거지',
    'revealed': revealed,
    'self': {
      'participating': participating,
      'revealed': ownRevealed,
      'canReveal': status == 'active' && participating && !ownRevealed,
    },
    'blockedPolicy': null,
  },
};
void main() {
  late FakeTransport t;
  late GameRepository repo;
  late PendingGameCommands owner;
  setUp(() {
    t = FakeTransport();
    repo = GameRepository(
      ApiClient(
        transport: t,
        resolver: const NativeRoutes(),
        accessToken: () async => 'synthetic',
      ),
      requestId: () => 'draw-intent',
    );
    owner = PendingGameCommands();
  });
  Widget screen({String id = 'run-a'}) => MaterialApp(
    home: GameScreen(
      repository: repo,
      roomId: 'room-a',
      runId: id,
      accountScope: 'account-a',
      pendingCommands: owner,
      viewerMembershipId: 'm1',
      onSessionLost: () {},
      play: (_, run, c) => DrawGameView(
        run: run,
        controller: c,
        viewerMembershipId: 'm1',
        names: const {'m1': '합성1', 'm2': '합성2'},
      ),
    ),
  );
  for (final n in [2, 3, 5]) {
    testWidgets(
      '$n players see one own preassigned lot and only public results',
      (tester) async {
        t.handler = (_) async => ok(drawRun(n));
        await tester.pumpWidget(screen());
        await tester.pump();
        await tester.pump();
        expect(find.text('내 제비 공개'), findsOneWidget);
        expect(find.text('당첨'), findsNothing);
        expect(find.text('통과'), findsNothing);
        expect(find.text('공개 0명 / 참가 $n명'), findsOneWidget);
        expect(find.byType(GridView), findsNothing);
        expect(t.requests.where((r) => r.method != 'GET'), isEmpty);
        await tester.pumpWidget(const SizedBox());
      },
    );
  }
  testWidgets(
    'reveal waits for server acknowledgment and double tap sends one exact versioned intent',
    (tester) async {
      final response = Completer<TransportResponse>();
      t.handler = (r) async =>
          r.method == 'GET' ? ok(drawRun(3)) : response.future;
      await tester.pumpWidget(screen());
      await tester.pump();
      await tester.pump();
      await tester.tap(find.text('내 제비 공개'));
      await tester.pump();
      expect(find.text('당첨'), findsNothing);
      expect(find.text('서버 확인 중'), findsOneWidget);
      expect(t.requests.where((r) => r.method == 'POST').length, 1);
      expect(
        tester
            .widget<FilledButton>(find.widgetWithText(FilledButton, '서버 확인 중'))
            .onPressed,
        isNull,
      );
      response.complete(
        ok(
          drawRun(
            3,
            ownRevealed: true,
            revealed: [
              {'membershipId': 'm1', 'winner': true},
            ],
          ),
        ),
      );
      await tester.pump();
      await tester.pump();
      expect(find.text('당첨'), findsOneWidget);
      expect(
        jsonDecode(t.requests.firstWhere((r) => r.method == 'POST').body!),
        {
          'requestId': 'draw-intent',
          'expectedVersion': 4,
          'command': {'kind': 'reveal'},
        },
      );
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'ambiguous failure keeps hidden result and explicit retry reuses exact bytes',
    (tester) async {
      var fail = true;
      t.handler = (r) async {
        if (r.method == 'GET') return ok(drawRun(2));
        if (fail) throw const ApiFailure(FailureKind.network);
        return ok(
          drawRun(
            2,
            ownRevealed: true,
            revealed: [
              {'membershipId': 'm1', 'winner': false},
            ],
          ),
        );
      };
      await tester.pumpWidget(screen());
      await tester.pump();
      await tester.pump();
      await tester.tap(find.text('내 제비 공개'));
      await tester.pump();
      await tester.pump();
      expect(find.text('당첨'), findsNothing);
      expect(find.text('통과'), findsNothing);
      final first = t.requests.last.body;
      fail = false;
      await tester.tap(find.text('같은 요청 다시 보내기'));
      await tester.pump();
      await tester.pump();
      expect(t.requests.last.body, first);
      expect(find.text('통과'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'observer has no own lot; incomplete exposes only previously revealed numbers',
    (tester) async {
      t.handler = (_) async => ok(
        drawRun(
          5,
          status: 'incomplete',
          participating: false,
          revealed: [
            {'membershipId': 'm2', 'winner': false},
          ],
        ),
      );
      await tester.pumpWidget(screen());
      await tester.pump();
      await tester.pump();
      expect(find.text('내 제비 공개'), findsNothing);
      expect(find.text('제비뽑기가 중단됐어요.'), findsOneWidget);
      expect(find.text('합성2'), findsOneWidget);
      expect(find.text('통과'), findsOneWidget);
      expect(find.text('당첨'), findsNothing);
      expect(find.text('공개 1명 / 참가 5명'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'deadline conflict refreshes interrupted server state without reveal retry',
    (tester) async {
      var expired = false;
      t.handler = (r) async {
        if (r.method == 'POST') {
          expired = true;
          return const TransportResponse(
            409,
            '{"error":{"code":"STATE_CONFLICT"}}',
          );
        }
        return ok(drawRun(3, status: expired ? 'incomplete' : 'active'));
      };
      await tester.pumpWidget(screen());
      await tester.pump();
      await tester.pump();
      await tester.tap(find.text('내 제비 공개'));
      await tester.pump();
      await tester.pump();
      expect(find.text('제비뽑기가 중단됐어요.'), findsOneWidget);
      expect(t.requests.where((r) => r.method == 'POST').length, 1);
      expect(find.text('당첨'), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets('late reveal response cannot replace a newly opened run', (
    tester,
  ) async {
    final old = Completer<TransportResponse>();
    t.handler = (r) async => r.method == 'POST'
        ? old.future
        : ok(drawRun(2, id: r.uri.path.endsWith('run-b') ? 'run-b' : 'run-a'));
    await tester.pumpWidget(screen());
    await tester.pump();
    await tester.pump();
    await tester.tap(find.text('내 제비 공개'));
    await tester.pump();
    await tester.pumpWidget(screen(id: 'run-b'));
    await tester.pump();
    await tester.pump();
    old.complete(
      ok(
        drawRun(
          2,
          ownRevealed: true,
          revealed: [
            {'membershipId': 'm1', 'winner': true},
          ],
        ),
      ),
    );
    await tester.pump();
    await tester.pump();
    expect(find.text('당첨'), findsNothing);
    expect(find.text('내 제비 공개'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets(
    'setup collects N and required penalty; no request sent from setup itself',
    (tester) async {
      JsonMap? settings;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DrawSetupForm(
              selected: const ['m1', 'm2', 'm3'],
              onComplete: (v) => settings = v,
            ),
          ),
        ),
      );
      expect(
        tester
            .widget<FilledButton>(find.widgetWithText(FilledButton, '설정 적용'))
            .onPressed,
        isNull,
      );
      await tester.enterText(
        find.byKey(const Key('draw-penalty')),
        '  합성 설거지  ',
      );
      await tester.pump();
      await tester.tap(find.byKey(const Key('draw-count')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('2명').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('설정 적용'));
      await tester.pump();
      expect(settings, {'winnerCount': 2, 'penaltyText': '합성 설거지'});
    },
  );
  testWidgets(
    'completed, missing and redacted projections never create a new reveal',
    (tester) async {
      t.handler = (_) async => ok(
        drawRun(
          2,
          status: 'completed',
          ownRevealed: true,
          revealed: [
            {'membershipId': 'm1', 'winner': true},
            {'membershipId': 'm2', 'winner': false},
          ],
        ),
      );
      await tester.pumpWidget(screen());
      await tester.pump();
      await tester.pump();
      expect(find.text('제비뽑기 결과'), findsOneWidget);
      expect(find.text('당첨'), findsOneWidget);
      expect(find.text('통과'), findsOneWidget);
      expect(find.text('내 제비 공개'), findsNothing);
      final c = GameController(repo);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DrawGameView(
              run: RunDto.fromJson({...drawRun(2), 'game': null}),
              controller: c,
            ),
          ),
        ),
      );
      expect(find.text('제비 상태를 확인할 수 없어요.'), findsOneWidget);
      final deleted = {
        ...drawRun(2, status: 'completed'),
        'facilitatorMembershipId': null,
        'selectedMembershipIds': <String>[],
        'game': {
          'kind': 'draw',
          'redacted': true,
          'summary': {
            'participantCount': 2,
            'revealed': {'winnerCount': 0, 'notWinnerCount': 1},
          },
        },
      };
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DrawGameView(run: RunDto.fromJson(deleted), controller: c),
          ),
        ),
      );
      expect(find.textContaining('개인 내용이 삭제'), findsOneWidget);
      expect(find.text('합성 설거지'), findsNothing);
      expect(find.text('내 제비 공개'), findsNothing);
      expect(t.requests.where((r) => r.method != 'GET'), isEmpty);
      await tester.pumpWidget(const SizedBox());
      c.dispose();
    },
  );
}
