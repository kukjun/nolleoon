import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/features/games/game_repository.dart';
import 'package:nolleoon_mobile/features/games/game_controller.dart';
import 'package:nolleoon_mobile/features/games/game_screen.dart';

import 'games_test.dart' show FakeTransport, ok, run;

void main() {
  testWidgets(
    'restricted trial stage controls are explicit and never receive private play',
    (tester) async {
      final t = FakeTransport()
        ..handler = (_) async => ok({
          ...run(),
          'type': 'trial',
          'game': {'kind': 'trial', 'restricted': true, 'phase': 'defense'},
        });
      final repo = GameRepository(
        ApiClient(
          transport: t,
          resolver: const NativeRoutes(),
          accessToken: () async => 'synthetic',
        ),
      );
      final owner = PendingGameCommands();
      var private = 0, controls = 0;
      Widget screen(String viewer) => MaterialApp(
        home: GameScreen(
          accountScope: 'account-a',
          pendingCommands: owner,
          repository: repo,
          roomId: 'room-a',
          runId: 'run-a',
          viewerMembershipId: viewer,
          onSessionLost: () {},
          play: (_, _, _) {
            private++;
            return const Text('private');
          },
          restrictedControls: (_, r, _) {
            controls++;
            expect(r.game!.data.keys.toSet(), {'kind', 'restricted', 'phase'});
            return const Text('stage-only');
          },
        ),
      );
      await tester.pumpWidget(screen('member-a'));
      await tester.pump();
      await tester.pump();
      expect(private, 0);
      expect(controls, greaterThan(0));
      expect(find.text('stage-only'), findsOneWidget);
      controls = 0;
      await tester.pumpWidget(screen('observer'));
      await tester.pump();
      await tester.pump();
      expect(private, 0);
      expect(controls, 0);
      expect(find.text('stage-only'), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );
}
