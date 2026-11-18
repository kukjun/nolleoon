import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/features/rooms/rooms_repository.dart';
import 'package:nolleoon_mobile/features/rooms/rooms_screen.dart';

import 'rooms_test.dart' as f;

void main() {
  for (final width in [320.0, 390.0]) {
    testWidgets('empty create lobby back at $width', (tester) async {
      tester.view.physicalSize = Size(width, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final t = f.FakeTransport();
      t.handler = (r) async => f.ok(
        r.method == 'POST' ? f.room() : {'items': [], 'nextCursor': null},
      );
      final repository = RoomsRepository(
        ApiClient(
          transport: t,
          resolver: const NativeRoutes(),
          accessToken: () async => 'synthetic',
        ),
        requestId: () => 'request-widget',
      );
      await tester.pumpWidget(
        MaterialApp(
          home: RoomsScreen(repository: repository, onSessionLost: () {}),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('아직 참여한 여행방'), findsOneWidget);
      await tester.tap(find.text('새 여행방 만들기'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '합성 여행');
      await tester.pump();
      await tester.ensureVisible(find.widgetWithText(FilledButton, '여행방 만들기'));
      await tester.tap(find.widgetWithText(FilledButton, '여행방 만들기'));
      await tester.pumpAndSettle();
      expect(find.text('합성 여행'), findsOneWidget);
      expect(find.text('여행자 (나)'), findsOneWidget);
      expect(find.text('방 관리자 · 연결됨'), findsOneWidget);
      expect(find.text('진행 중인 판이 없어요.'), findsOneWidget);
      expect(t.requests.where((r) => r.method == 'POST').length, 1);
      expect(t.requests.first.uri.path, '/api/native/travel-rooms');
      expect(tester.takeException(), isNull);
      await tester.tap(find.byTooltip('목록으로'));
      await tester.pumpAndSettle();
      expect(find.text('내 여행방'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    });
  }
  testWidgets(
    'cancel create preserves draft, confirm leaves without mutation',
    (tester) async {
      final t = f.FakeTransport();
      t.handler = (r) async => f.ok({'items': [], 'nextCursor': null});
      await tester.pumpWidget(
        MaterialApp(
          home: RoomsScreen(
            repository: RoomsRepository(
              ApiClient(
                transport: t,
                resolver: const NativeRoutes(),
                accessToken: () async => 'synthetic',
              ),
            ),
            onSessionLost: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('새 여행방 만들기'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '작성 중');
      await tester.tap(find.byTooltip('목록으로'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('계속 작성'));
      await tester.pumpAndSettle();
      expect(find.text('작성 중'), findsOneWidget);
      await tester.tap(find.byTooltip('목록으로'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, '목록으로'));
      await tester.pumpAndSettle();
      expect(find.text('내 여행방'), findsOneWidget);
      expect(t.requests.every((r) => r.method == 'GET'), isTrue);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets('lobby polls only foreground and stops after dispose', (
    tester,
  ) async {
    final t = f.FakeTransport();
    t.handler = (r) async =>
        f.ok(r.uri.path.endsWith('room-a') ? f.room() : f.page('room-a', null));
    await tester.pumpWidget(
      MaterialApp(
        home: RoomsScreen(
          repository: RoomsRepository(
            ApiClient(
              transport: t,
              resolver: const NativeRoutes(),
              accessToken: () async => 'synthetic',
            ),
          ),
          onSessionLost: () {},
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('합성 여행'));
    await tester.pumpAndSettle();
    final count = t.requests.length;
    await tester.pump(const Duration(seconds: 9));
    expect(t.requests.length, count);
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();
    expect(t.requests.length, count + 1);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    await tester.pump();
    expect(find.text('여행자 (나)'), findsNothing);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    final paused = t.requests.length;
    await tester.pump(const Duration(seconds: 30));
    expect(t.requests.length, paused);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();
    expect(find.text('여행자 (나)'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    final disposed = t.requests.length;
    await tester.pump(const Duration(seconds: 30));
    expect(t.requests.length, disposed);
  });
  testWidgets('game route callback hides lobby and rejects repeated entry', (
    tester,
  ) async {
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    final t = f.FakeTransport();
    final detail = f.room();
    detail['activeRun'] = {
      'runId': 'run-a',
      'type': 'team',
      'status': 'active',
      'facilitatorMembershipId': 'member-a',
    };
    t.handler = (r) async =>
        f.ok(r.uri.path.endsWith('room-a') ? detail : f.page('room-a', null));
    final child = Completer<void>();
    var opens = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: RoomsScreen(
          repository: RoomsRepository(
            ApiClient(
              transport: t,
              resolver: const NativeRoutes(),
              accessToken: () async => 'synthetic',
            ),
          ),
          onSessionLost: () {},
          onOpenRun: (room, run) async {
            expect(room, 'room-a');
            expect(run, 'run-a');
            opens++;
            await child.future;
          },
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('합성 여행'));
    await tester.pumpAndSettle();
    final button = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, '현재 판 보기'),
    );
    button.onPressed!();
    button.onPressed!();
    await tester.pump();
    expect(opens, 1);
    expect(find.text('여행자 (나)'), findsNothing);
    final count = t.requests.length;
    await tester.pump(const Duration(seconds: 20));
    expect(t.requests.length, count);
    child.complete();
    await tester.pumpAndSettle();
    expect(find.text('여행자 (나)'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
