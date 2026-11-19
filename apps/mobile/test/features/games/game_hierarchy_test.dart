import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/theme.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/features/games/game_controller.dart';
import 'package:nolleoon_mobile/features/games/game_repository.dart';
import 'package:nolleoon_mobile/features/games/game_screen.dart';

import 'games_test.dart' as f;

void main() {
  testWidgets('draft keeps one primary start and no terminal exit', (t) async {
    final transport = f.FakeTransport()..handler = (_) async => f.ok(f.run());
    await t.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: GameScreen(
          repository: GameRepository(
            ApiClient(
              transport: transport,
              resolver: const NativeRoutes(),
              accessToken: () async => 'synthetic',
            ),
          ),
          roomId: 'room-a',
          runId: 'run-a',
          accountScope: 'A',
          viewerMembershipId: 'member-a',
          pendingCommands: PendingGameCommands(),
          onSessionLost: () {},
          onExit: () {},
          editConfigure: (_, _, done) => const SizedBox(),
        ),
      ),
    );
    await t.pumpAndSettle();
    expect(find.text('로비로 돌아가기'), findsNothing);
    expect(find.widgetWithText(FilledButton, '게임 시작'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, '설정 수정'), findsOneWidget);
    expect(find.widgetWithText(TextButton, '준비 취소'), findsOneWidget);
    expect(
      t.getTopLeft(find.text('게임 시작')).dy,
      lessThan(t.getTopLeft(find.text('설정 수정')).dy),
    );
    expect(transport.requests.where((r) => r.method != 'GET'), isEmpty);
    await t.pumpWidget(const SizedBox());
  });
  for (final layout in [(320.0, 568.0, 2.0), (390.0, 844.0, 1.6)]) {
    testWidgets(
      'completed result has local exit and no shell card at $layout',
      (t) async {
        t.view.physicalSize = Size(layout.$1, layout.$2);
        t.view.devicePixelRatio = 1;
        addTearDown(t.view.resetPhysicalSize);
        addTearDown(t.view.resetDevicePixelRatio);
        final transport = f.FakeTransport()
          ..handler = (_) async => f.ok({
            ...f.run(),
            'status': 'completed',
            'endedAt': 2000,
            'game': {
              'kind': 'team',
              'teamCount': 2,
              'assignments': [
                {'membershipId': 'member-a', 'team': 1},
                {'membershipId': 'member-b', 'team': 2},
              ],
            },
          });
        var exits = 0;
        await t.pumpWidget(
          MaterialApp(
            theme: buildAppTheme(),
            builder: (c, w) => MediaQuery(
              data: MediaQuery.of(c)
                  .copyWith(textScaler: TextScaler.linear(layout.$3)),
              child: w!,
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
              runId: 'run-a',
              accountScope: 'A',
              pendingCommands: PendingGameCommands(),
              onSessionLost: () {},
              onExit: () => exits++,
              play: (_, _, _) =>
                  const Text('아주 긴 한국어 결과 제목과 참가자 이름을 줄이지 않고 모두 보여주는 결과입니다'),
            ),
          ),
        );
        await t.pumpAndSettle();
        expect(find.byType(Card), findsNothing);
        await t.scrollUntilVisible(
          find.text('로비로 돌아가기'),
          160,
          scrollable: find.byType(Scrollable).first,
        );
        expect(find.text('로비로 돌아가기').hitTestable(), findsOneWidget);
        await t.tap(find.text('로비로 돌아가기'));
        await t.pump();
        expect(exits, 1);
        expect(transport.requests.where((r) => r.method != 'GET'), isEmpty);
        expect(t.takeException(), isNull);
        await t.pumpWidget(const SizedBox());
      },
    );
  }
}
