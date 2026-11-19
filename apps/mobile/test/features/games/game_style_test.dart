import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/features/games/game_controller.dart';
import 'package:nolleoon_mobile/features/games/game_repository.dart';
import 'package:nolleoon_mobile/features/games/game_screen.dart';

import '../rooms/rooms_test.dart' as f;

import 'package:nolleoon_mobile/theme.dart';

void main() {
  for (final width in [320.0, 390.0]) {
    testWidgets('game cards separate selection from participants at $width', (
      t,
    ) async {
      t.view.physicalSize = Size(width, 844);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.resetPhysicalSize);
      addTearDown(t.view.resetDevicePixelRatio);
      final transport = f.FakeTransport()
        ..handler = (_) async => f.ok(f.room());
      await t.pumpWidget(
        MaterialApp(
          theme: buildAppTheme(),
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context)
                .copyWith(textScaler: const TextScaler.linear(1.6)),
            child: child!,
          ),
          home: GameScreen(
            repository: GameRepository(
              ApiClient(
                transport: transport,
                resolver: const NativeRoutes(),
                accessToken: () async => 'synthetic',
              ),
            ),
            roomId: 'room-a',
            accountScope: 'A',
            pendingCommands: PendingGameCommands(),
            onSessionLost: () {},
          ),
        ),
      );
      await t.pumpAndSettle();
      expect(find.text('여행 멤버를 팀으로 나눠요.'), findsOneWidget);
      expect(find.byType(CheckboxListTile), findsNothing);
      await t.tap(find.text('팀 나누기'));
      await t.pumpAndSettle();
      expect(find.text('함께할 사람을 골라요'), findsOneWidget);
      expect(find.byType(CheckboxListTile), findsOneWidget);
      expect(find.text('여행 멤버를 팀으로 나눠요.'), findsNothing);
      await t.tap(find.byType(CheckboxListTile));
      await t.pump();
      expect(find.text('1명 선택'), findsOneWidget);
      await t.tap(find.text('게임 다시 고르기'));
      await t.pump();
      expect(find.byType(CheckboxListTile), findsNothing);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
    });
  }
}
