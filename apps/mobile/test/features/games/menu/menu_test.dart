import 'dart:async';
import 'dart:convert';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/data/wire_models.dart';
import 'package:nolleoon_mobile/features/games/game_controller.dart';
import 'package:nolleoon_mobile/features/games/game_repository.dart';
import 'package:nolleoon_mobile/features/games/game_screen.dart';
import 'package:nolleoon_mobile/features/games/menu/menu_game.dart';

import '../games_test.dart' show FakeTransport, ok;

Map<String, Object?> menuRun({
  String phase = 'collecting',
  bool eligible = true,
  Object? submission,
  Object? result,
  String id = 'run-a',
}) => {
  'runId': id,
  'roomId': 'room-a',
  'type': 'menu',
  'status': phase == 'collecting' ? 'active' : phase,
  'version': 5,
  'facilitatorMembershipId': 'm1',
  'selectedMembershipIds': ['m1', 'm2', 'm3'],
  'createdAt': 1000,
  'startedAt': phase == 'draft' ? null : 2000,
  'endedAt': ['incomplete', 'completed'].contains(phase) ? 3000 : null,
  'isParticipant': eligible,
  'game': {
    'kind': 'menu',
    'phase': phase,
    'self': {'eligible': eligible, 'submission': submission},
    'result': result,
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
      requestId: () => 'menu-intent',
    );
    owner = PendingGameCommands();
  });
  Widget screen({String id = 'run-a', String viewer = 'm1'}) => MaterialApp(
    home: GameScreen(
      repository: repo,
      roomId: 'room-a',
      runId: id,
      accountScope: 'account-a',
      pendingCommands: owner,
      viewerMembershipId: viewer,
      onSessionLost: () {},
      play: (_, run, c) =>
          MenuGameView(run: run, controller: c, viewerMembershipId: viewer),
    ),
  );
  testWidgets('setup emits empty settings and no command', (tester) async {
    JsonMap? value;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MenuSetupForm(
            selected: const ['m1', 'm2'],
            onComplete: (v) => value = v,
          ),
        ),
      ),
    );
    await tester.tap(find.text('설정 적용'));
    await tester.pump();
    expect(value, <String, Object?>{});
    expect(t.requests, isEmpty);
  });
  testWidgets(
    'candidate waits for ack and shows only own normalized submission',
    (tester) async {
      final response = Completer<TransportResponse>();
      t.handler = (r) async =>
          r.method == 'GET' ? ok(menuRun()) : response.future;
      await tester.pumpWidget(screen());
      await tester.pump();
      await tester.pump();
      await tester.enterText(
        find.byKey(const Key('menu-candidate')),
        '  PIZZA  ',
      );
      await tester.pump();
      await tester.tap(find.text('후보 보내기'));
      await tester.pump();
      expect(find.text('내 응답을 보냈어요.'), findsNothing);
      expect(
        tester
            .widget<FilledButton>(find.widgetWithText(FilledButton, '후보 보내기'))
            .onPressed,
        isNull,
      );
      expect(t.requests.where((r) => r.method == 'POST').length, 1);
      response.complete(
        ok(menuRun(submission: {'kind': 'candidate', 'menu': 'pizza'})),
      );
      await tester.pump();
      await tester.pump();
      expect(find.text('pizza'), findsOneWidget);
      expect(find.text('내 응답을 보냈어요.'), findsOneWidget);
      expect(find.byKey(const Key('menu-candidate')), findsNothing);
      expect(
        jsonDecode(t.requests.firstWhere((r) => r.method == 'POST').body!),
        {
          'requestId': 'menu-intent',
          'expectedVersion': 5,
          'command': {'type': 'submit', 'menu': '  PIZZA  '},
        },
      );
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets('pass is explicit and final no-choice is server decided', (
    tester,
  ) async {
    t.handler = (r) async => ok(
      r.method == 'GET'
          ? menuRun()
          : menuRun(phase: 'completed', result: {'outcome': 'no-choice'}),
    );
    await tester.pumpWidget(screen());
    await tester.pump();
    await tester.pump();
    await tester.tap(find.text('이번에는 패스'));
    await tester.pump();
    await tester.pump();
    expect(find.text('선택된 메뉴가 없어요.'), findsOneWidget);
    expect(jsonDecode(t.requests.last.body!)['command'], {'type': 'pass'});
    expect(find.text('후보 보내기'), findsNothing);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets(
    'ambiguous submission retry uses same id and original text, not edited draft',
    (tester) async {
      var fail = true;
      t.handler = (r) async {
        if (r.method == 'GET') return ok(menuRun());
        if (fail) throw const ApiFailure(FailureKind.network);
        return ok(menuRun(submission: {'kind': 'candidate', 'menu': '국수'}));
      };
      await tester.pumpWidget(screen());
      await tester.pump();
      await tester.pump();
      await tester.enterText(find.byKey(const Key('menu-candidate')), '국수');
      await tester.pump();
      await tester.tap(find.text('후보 보내기'));
      await tester.pump();
      await tester.pump();
      final original = t.requests.last.body;
      expect(
        tester
            .widget<TextField>(find.byKey(const Key('menu-candidate')))
            .enabled,
        false,
      );
      fail = false;
      await tester.tap(find.text('같은 요청 다시 보내기'));
      await tester.pump();
      await tester.pump();
      expect(t.requests.last.body, original);
      expect(find.text('내 응답을 보냈어요.'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'observer cannot respond; nonparticipant facilitator can cancel without learning candidates',
    (tester) async {
      t.handler = (r) async => ok(
        r.method == 'GET'
            ? menuRun(eligible: false)
            : menuRun(phase: 'incomplete', eligible: false),
      );
      await tester.pumpWidget(screen(viewer: 'observer'));
      await tester.pump();
      await tester.pump();
      expect(find.byKey(const Key('menu-candidate')), findsNothing);
      expect(find.text('수집 중단'), findsNothing);
      expect(find.text('다른 사람의 후보는 공개하지 않아요.'), findsOneWidget);
      await tester.pumpWidget(screen(viewer: 'm1'));
      await tester.pump();
      await tester.pump();
      await tester.tap(find.text('수집 중단'));
      await tester.pump();
      await tester.pump();
      expect(find.text('메뉴 선택이 중단됐어요.'), findsOneWidget);
      expect(jsonDecode(t.requests.last.body!)['command'], {'type': 'cancel'});
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'version conflict reveals only latest final selection and does not re-vote',
    (tester) async {
      var completed = false;
      t.handler = (r) async {
        if (r.method == 'POST') {
          completed = true;
          return const TransportResponse(
            409,
            '{"error":{"code":"STATE_CONFLICT"}}',
          );
        }
        return ok(
          completed
              ? menuRun(
                  phase: 'completed',
                  result: {'outcome': 'selected', 'menu': '김밥'},
                )
              : menuRun(),
        );
      };
      await tester.pumpWidget(screen());
      await tester.pump();
      await tester.pump();
      await tester.enterText(find.byKey(const Key('menu-candidate')), '국수');
      await tester.pump();
      await tester.tap(find.text('후보 보내기'));
      await tester.pump();
      await tester.pump();
      expect(find.text('김밥'), findsOneWidget);
      expect(find.text('국수'), findsNothing);
      expect(t.requests.where((r) => r.method == 'POST').length, 1);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets('old run response and input cannot appear in a new game', (
    tester,
  ) async {
    final response = Completer<TransportResponse>();
    t.handler = (r) async => r.method == 'POST'
        ? response.future
        : ok(menuRun(id: r.uri.path.endsWith('run-b') ? 'run-b' : 'run-a'));
    await tester.pumpWidget(screen());
    await tester.pump();
    await tester.pump();
    await tester.enterText(find.byKey(const Key('menu-candidate')), '옛 개인후보');
    await tester.pump();
    await tester.tap(find.text('후보 보내기'));
    await tester.pump();
    await tester.pumpWidget(screen(id: 'run-b'));
    await tester.pump();
    await tester.pump();
    response.complete(
      ok(menuRun(submission: {'kind': 'candidate', 'menu': '옛 개인후보'})),
    );
    await tester.pump();
    expect(find.text('옛 개인후보'), findsNothing);
    expect(
      tester
          .widget<TextField>(find.byKey(const Key('menu-candidate')))
          .controller!
          .text,
      isEmpty,
    );
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets(
    'background clears unsubmitted private candidate and never sends it on resume',
    (tester) async {
      t.handler = (_) async => ok(menuRun());
      await tester.pumpWidget(screen());
      await tester.pump();
      await tester.pump();
      await tester.enterText(
        find.byKey(const Key('menu-candidate')),
        '개인 임시후보',
      );
      await tester.pump();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pump();
      expect(find.text('개인 임시후보'), findsNothing);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      await tester.pump();
      expect(
        tester
            .widget<TextField>(find.byKey(const Key('menu-candidate')))
            .controller!
            .text,
        isEmpty,
      );
      expect(t.requests.where((r) => r.method != 'GET'), isEmpty);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'null and redacted menu snapshots never retain editable private text',
    (tester) async {
      final c = GameController(repo);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MenuGameView(
              run: RunDto.fromJson({...menuRun(), 'game': null}),
              controller: c,
            ),
          ),
        ),
      );
      expect(find.text('메뉴 상태를 확인할 수 없어요.'), findsOneWidget);
      final deleted = {
        ...menuRun(phase: 'completed'),
        'facilitatorMembershipId': null,
        'selectedMembershipIds': <String>[],
        'game': {
          'kind': 'menu',
          'redacted': true,
          'summary': {'participantCount': 3, 'responseCount': 2},
        },
      };
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MenuGameView(run: RunDto.fromJson(deleted), controller: c),
          ),
        ),
      );
      expect(find.textContaining('개인 내용이 삭제'), findsOneWidget);
      expect(find.byKey(const Key('menu-candidate')), findsNothing);
      expect(t.requests, isEmpty);
      await tester.pumpWidget(const SizedBox());
      c.dispose();
    },
  );
}
