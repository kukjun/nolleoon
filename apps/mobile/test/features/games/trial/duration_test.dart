import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/features/games/game_controller.dart';
import 'package:nolleoon_mobile/features/games/game_repository.dart';
import 'package:nolleoon_mobile/features/games/game_screen.dart';
import 'package:nolleoon_mobile/features/games/trial/trial_game.dart';

import '../games_test.dart' show FakeTransport, ok;
import 'trial_test.dart' show trialRun;

void main() {
  testWidgets(
    'clean duration selection follows latest same-phase server snapshot',
    (tester) async {
      var state = trialRun(phase: 'defense');
      final t = FakeTransport()..handler = (_) async => ok(state);
      final repo = GameRepository(
        ApiClient(
          transport: t,
          resolver: const NativeRoutes(),
          accessToken: () async => 'synthetic',
        ),
      );
      await tester.pumpWidget(
        MaterialApp(
          home: GameScreen(
            repository: repo,
            roomId: 'room-a',
            runId: 'run-a',
            accountScope: 'a',
            pendingCommands: PendingGameCommands(),
            viewerMembershipId: 'm1',
            onSessionLost: () {},
            play: (_, r, c) =>
                TrialGameView(run: r, controller: c, viewerMembershipId: 'm1'),
          ),
        ),
      );
      await tester.pump();
      await tester.pump();
      await tester.tap(find.text('투표 제한시간 180초'));
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<DropdownButton<int>>(
              find.byKey(const Key('trial-duration')),
            )
            .value,
        3,
      );
      state = {
        ...state,
        'version': 8,
        'game': {...state['game'] as Map, 'durationSeconds': 300},
      };
      await tester.tap(find.text('최신 상태 확인'));
      await tester.pump();
      await tester.pump();
      expect(find.text('투표 제한시간 300초'), findsOneWidget);
      expect(
        tester
            .widget<DropdownButton<int>>(
              find.byKey(const Key('trial-duration')),
            )
            .value,
        5,
      );
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'dirty duration survives polling, blocks start until server acknowledgement or explicit discard',
    (tester) async {
      var state = trialRun(phase: 'defense');
      final ack = Completer<TransportResponse>();
      final t = FakeTransport()
        ..handler = (r) async => r.method == 'GET' ? ok(state) : ack.future;
      final repo = GameRepository(
        ApiClient(
          transport: t,
          resolver: const NativeRoutes(),
          accessToken: () async => 'synthetic',
        ),
      );
      await tester.pumpWidget(
        MaterialApp(
          home: GameScreen(
            repository: repo,
            roomId: 'room-a',
            runId: 'run-a',
            accountScope: 'a',
            pendingCommands: PendingGameCommands(),
            viewerMembershipId: 'm1',
            onSessionLost: () {},
            play: (_, r, c) =>
                TrialGameView(run: r, controller: c, viewerMembershipId: 'm1'),
          ),
        ),
      );
      await tester.pump();
      await tester.pump();
      await tester.tap(find.text('투표 제한시간 180초'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('trial-duration')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('4분').last);
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, '모두 함께 투표 시작'),
            )
            .onPressed,
        isNull,
      );
      expect(find.textContaining('아직 적용되지'), findsOneWidget);
      state = {
        ...state,
        'version': 8,
        'game': {...state['game'] as Map, 'durationSeconds': 300},
      };
      await tester.ensureVisible(find.text('최신 상태 확인'));
      await tester.tap(find.text('최신 상태 확인'));
      await tester.pump();
      await tester.pump();
      expect(
        tester
            .widget<DropdownButton<int>>(
              find.byKey(const Key('trial-duration')),
            )
            .value,
        4,
      );
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, '모두 함께 투표 시작'),
            )
            .onPressed,
        isNull,
      );
      await tester.ensureVisible(find.text('저장된 시간으로 되돌리기'));
      await tester.tap(find.text('저장된 시간으로 되돌리기'));
      await tester.pump();
      expect(
        tester
            .widget<DropdownButton<int>>(
              find.byKey(const Key('trial-duration')),
            )
            .value,
        5,
      );
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, '모두 함께 투표 시작'),
            )
            .onPressed,
        isNotNull,
      );
      await tester.tap(find.byKey(const Key('trial-duration')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('4분').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('시간 적용'));
      await tester.pump();
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, '모두 함께 투표 시작'),
            )
            .onPressed,
        isNull,
      );
      state = {
        ...state,
        'version': 9,
        'game': {...state['game'] as Map, 'durationSeconds': 240},
      };
      ack.complete(ok(state));
      await tester.pump();
      await tester.pump();
      expect(find.textContaining('아직 적용되지'), findsNothing);
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, '모두 함께 투표 시작'),
            )
            .onPressed,
        isNotNull,
      );
      expect(t.requests.where((r) => r.method == 'POST').length, 1);
      await tester.pumpWidget(const SizedBox());
    },
  );
}
