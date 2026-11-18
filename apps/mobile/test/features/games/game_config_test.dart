import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/data/wire_models.dart';
import 'package:nolleoon_mobile/features/games/game_repository.dart';
import 'package:nolleoon_mobile/features/games/game_controller.dart';
import 'package:nolleoon_mobile/features/games/game_screen.dart';

import 'games_test.dart' as f;

void main() {
  testWidgets(
    'configuration lifecycle cancels only owned modal and old completion cannot disturb newer one',
    (t) async {
      final transport = f.FakeTransport()
        ..handler = (_) async => f.ok({
          'roomId': 'room-a',
          'title': 'room',
          'startDate': null,
          'endDate': null,
          'status': 'open',
          'version': 1,
          'self': {'membershipId': 'member-a', 'isAdmin': true},
          'members': [
            {
              'membershipId': 'member-a',
              'nickname': 'A',
              'presetId': 'preset-01',
              'connected': true,
              'isAdmin': true,
            },
          ],
          'activeRun': null,
        });
      final r = GameRepository(
        ApiClient(
          transport: transport,
          resolver: const NativeRoutes(),
          accessToken: () async => 'synthetic',
        ),
      );
      final completions = <ValueChanged<JsonMap?>>[];
      await t.pumpWidget(
        MaterialApp(
          home: GameScreen(
            repository: r,
            roomId: 'room-a',
            accountScope: 'A',
            pendingCommands: PendingGameCommands(),
            onSessionLost: () {},
            configure: (_, _, _, done) {
              completions.add(done);
              return const AlertDialog(content: Text('private-owned-config'));
            },
          ),
        ),
      );
      await t.pumpAndSettle();
      await t.tap(find.byType(CheckboxListTile));
      await t.pump();
      await t.tap(find.text('게임 설정'));
      await t.pumpAndSettle();
      expect(find.text('private-owned-config'), findsOneWidget);
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await t.pumpAndSettle();
      expect(find.text('private-owned-config'), findsNothing);
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await t.pumpAndSettle();
      expect(find.text('어떤 게임을 할까요?'), findsOneWidget);
      await t.tap(find.byType(CheckboxListTile));
      await t.pump();
      await t.tap(find.text('게임 설정'));
      await t.pumpAndSettle();
      completions.first({'teamCount': 2});
      await t.pumpAndSettle();
      expect(find.text('private-owned-config'), findsOneWidget);
      expect(transport.requests.where((r) => r.method != 'GET'), isEmpty);
      completions.last(null);
      await t.pumpAndSettle();
      expect(find.text('private-owned-config'), findsNothing);
      expect(find.text('어떤 게임을 할까요?'), findsOneWidget);
      await t.pumpWidget(const SizedBox());
    },
  );
  testWidgets('disposing shell removes its owned config overlay', (t) async {
    final transport = f.FakeTransport()
      ..handler = (_) async => f.ok({
        'roomId': 'room-a',
        'title': 'room',
        'startDate': null,
        'endDate': null,
        'status': 'open',
        'version': 1,
        'self': {'membershipId': 'member-a', 'isAdmin': true},
        'members': [
          {
            'membershipId': 'member-a',
            'nickname': 'A',
            'presetId': 'preset-01',
            'connected': true,
            'isAdmin': true,
          },
        ],
        'activeRun': null,
      });
    final r = GameRepository(
      ApiClient(
        transport: transport,
        resolver: const NativeRoutes(),
        accessToken: () async => 'synthetic',
      ),
    );
    final show = ValueNotifier(true);
    final owner = PendingGameCommands();
    await t.pumpWidget(
      MaterialApp(
        home: ValueListenableBuilder<bool>(
          valueListenable: show,
          builder: (_, visible, _) => visible
              ? GameScreen(
                  repository: r,
                  roomId: 'room-a',
                  accountScope: 'A',
                  pendingCommands: owner,
                  onSessionLost: () {},
                  configure: (_, _, _, _) =>
                      const AlertDialog(content: Text('private-owned-config')),
                )
              : const Text('signed out'),
        ),
      ),
    );
    await t.pumpAndSettle();
    await t.tap(find.byType(CheckboxListTile));
    await t.pump();
    await t.tap(find.text('게임 설정'));
    await t.pumpAndSettle();
    show.value = false;
    await t.pumpAndSettle();
    expect(find.text('private-owned-config'), findsNothing);
    expect(find.text('signed out'), findsOneWidget);
    await t.pumpWidget(const SizedBox());
    show.dispose();
  });
}
