import 'dart:convert';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/features/games/game_controller.dart';
import 'package:nolleoon_mobile/features/games/game_repository.dart';
import 'package:nolleoon_mobile/features/games/game_screen.dart';
import 'package:nolleoon_mobile/features/games/trial/trial_game.dart';
import 'package:nolleoon_mobile/theme.dart';

import '../games_test.dart' show FakeTransport, ok;
import 'trial_test.dart' show trialRun;

Widget screen(FakeTransport t, String viewer, {double scale = 1}) {
  final repo = GameRepository(
    ApiClient(
      transport: t,
      resolver: const NativeRoutes(),
      accessToken: () async => 'synthetic',
    ),
    requestId: () => 'role-intent',
  );
  return MaterialApp(
    theme: buildAppTheme(),
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(context)
          .copyWith(textScaler: TextScaler.linear(scale)),
      child: child!,
    ),
    home: GameScreen(
      repository: repo,
      roomId: 'room-a',
      runId: 'run-a',
      accountScope: 'synthetic-account',
      pendingCommands: PendingGameCommands(),
      viewerMembershipId: viewer,
      onSessionLost: () {},
      play: (_, r, c) =>
          TrialGameView(run: r, controller: c, viewerMembershipId: viewer),
    ),
  );
}

void main() {
  testWidgets(
    'current facilitator alone gets begin vote; refresh removes old authority and grants new authority',
    (tester) async {
      final t = FakeTransport();
      var facilitator = 'm1';
      t.handler = (r) async => ok({
        ...trialRun(phase: 'defense'),
        'facilitatorMembershipId': facilitator,
      });
      await tester.pumpWidget(screen(t, 'm1'));
      await tester.pumpAndSettle();
      expect(find.text('모두 함께 투표 시작'), findsOneWidget);
      facilitator = 'm3';
      await tester.tap(find.text('최신 상태 확인'));
      await tester.pumpAndSettle();
      expect(find.text('모두 함께 투표 시작'), findsNothing);
      expect(t.requests.where((r) => r.method == 'POST'), isEmpty);
      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(screen(t, 'm2'));
      await tester.pumpAndSettle();
      expect(find.text('모두 함께 투표 시작'), findsNothing);
      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(screen(t, 'm3'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('모두 함께 투표 시작'));
      await tester.tap(find.text('모두 함께 투표 시작'));
      await tester.pumpAndSettle();
      expect(jsonDecode(t.requests.last.body!)['command'], {
        'action': 'begin-vote',
      });
      await tester.pumpWidget(const SizedBox());
    },
  );
  for (final isFacilitator in [false, true]) {
    testWidgets('defendant role independent from facilitator $isFacilitator', (
      tester,
    ) async {
      final t = FakeTransport();
      t.handler = (_) async => ok({
        ...trialRun(phase: 'defense', defendant: true),
        'facilitatorMembershipId': isFacilitator ? 'm2' : 'm1',
      });
      await tester.pumpWidget(screen(t, 'm2'));
      await tester.pumpAndSettle();
      expect(find.text('변론 제출'), findsOneWidget);
      expect(
        find.text('모두 함께 투표 시작'),
        isFacilitator ? findsOneWidget : findsNothing,
      );
      expect(t.requests.where((r) => r.method == 'POST'), isEmpty);
      await tester.pumpWidget(const SizedBox());
    });
  }
  for (final size in [const Size(320, 568), const Size(390, 844)]) {
    for (final scale in [1.6, 2.0]) {
      testWidgets(
        'pre-vote accessibility $size text $scale with long Korean context',
        (tester) async {
          tester.view.physicalSize = size;
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          final semantics = tester.ensureSemantics();
          try {
            final t = FakeTransport();
            final run = trialRun(phase: 'defense');
            run['game'] = {
              ...(run['game'] as Map<String, Object?>),
              'caseText': List.filled(
                12,
                '합성 여행 중 약속한 시간을 지키지 않은 사건입니다. ',
              ).join(),
              'penaltyText': List.filled(8, '서로 합의한 가벼운 정리 활동입니다. ').join(),
            };
            t.handler = (_) async => ok(run);
            await tester.pumpWidget(screen(t, 'm1', scale: scale));
            await tester.pumpAndSettle();
            expect(tester.takeException(), isNull);
            await expectLater(
              tester,
              meetsGuideline(androidTapTargetGuideline),
            );
            await expectLater(tester, meetsGuideline(iOSTapTargetGuideline));
            await expectLater(
              tester,
              meetsGuideline(labeledTapTargetGuideline),
            );
            await expectLater(tester, meetsGuideline(textContrastGuideline));
            await tester.scrollUntilVisible(
              find.text('모두 함께 투표 시작'),
              200,
              scrollable: find.byType(Scrollable).first,
            );
            await tester.pumpAndSettle();
            expect(tester.takeException(), isNull);
            await expectLater(
              tester,
              meetsGuideline(androidTapTargetGuideline),
            );
            await expectLater(tester, meetsGuideline(iOSTapTargetGuideline));
            await expectLater(
              tester,
              meetsGuideline(labeledTapTargetGuideline),
            );
            await expectLater(tester, meetsGuideline(textContrastGuideline));
            await tester.pumpWidget(const SizedBox());
          } finally {
            semantics.dispose();
          }
        },
      );
    }
  }
}
