import 'dart:convert';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/features/games/game_repository.dart';
import 'package:nolleoon_mobile/features/games/game_screen.dart';

import 'games_test.dart' show FakeTransport, run, ok;

void main() {
  testWidgets(
    'shell never pretends game-specific UI exists and background hides snapshot',
    (tester) async {
      final t = FakeTransport()..handler = (_) async => ok(run());
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
            onSessionLost: () {},
          ),
        ),
      );
      await tester.pump();
      await tester.pump();
      expect(find.text('게임 상태는 연결됐어요. 게임별 입력·결과 화면은 준비 중이에요.'), findsOneWidget);
      expect(find.text('게임 시작'), findsNothing);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pump();
      expect(find.byKey(const Key('run-status')), findsNothing);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      await tester.pump();
      expect(find.byKey(const Key('run-status')), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets('restricted data never enters injected sensitive play renderer', (
    tester,
  ) async {
    final t = FakeTransport()
      ..handler = (_) async => TransportResponse(
        200,
        jsonEncode({
          ...run(),
          'type': 'trial',
          'game': {'kind': 'trial', 'restricted': true, 'phase': 'defense'},
        }),
      );
    final repo = GameRepository(
      ApiClient(
        transport: t,
        resolver: const NativeRoutes(),
        accessToken: () async => 'synthetic',
      ),
    );
    var renderCalls = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: GameScreen(
          repository: repo,
          roomId: 'room-a',
          runId: 'run-a',
          onSessionLost: () {},
          play: (_, _, _) {
            renderCalls++;
            return const Text('private');
          },
        ),
      ),
    );
    await tester.pump();
    await tester.pump();
    expect(renderCalls, 0);
    expect(find.text('이 게임의 상세 내용은 볼 수 없어요.'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
}
