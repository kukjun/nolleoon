import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/features/rooms/rooms_controller.dart';
import 'package:nolleoon_mobile/features/rooms/rooms_repository.dart';
import 'package:nolleoon_mobile/features/rooms/rooms_screen.dart';

import 'rooms_test.dart' as f;

void main() {
  testWidgets(
    'unsent title and create location survive same account remount without POST',
    (tester) async {
      final t = f.FakeTransport()
        ..handler = (_) async => f.ok({'items': [], 'nextCursor': null});
      final repo = RoomsRepository(
        ApiClient(
          transport: t,
          resolver: const NativeRoutes(),
          accessToken: () async => 'synthetic',
        ),
      );
      final recovery = RoomsCreateRecovery('a');
      Widget screen() => MaterialApp(
        home: RoomsScreen(
          accountId: 'a',
          createRecovery: recovery,
          repository: repo,
          onSessionLost: () {},
        ),
      );
      await tester.pumpWidget(screen());
      await tester.pumpAndSettle();
      await tester.tap(find.text('새 여행방 만들기'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '작성 중인 제목');
      await tester.tap(find.text('시작일: 선택 안 함'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      final savedDate = tester.widget<Text>(find.textContaining('시작일:')).data;
      expect(savedDate, isNot('시작일: 선택 안 함'));
      await tester.pump();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pump();
      await tester.pumpWidget(const SizedBox());
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpWidget(screen());
      await tester.pumpAndSettle();
      expect(find.text('작성 중인 제목'), findsOneWidget);
      expect(find.text(savedDate!), findsOneWidget);
      expect(find.text('여행방 만들기'), findsWidgets);
      expect(t.requests.every((r) => r.method == 'GET'), true);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'explicit cancel and account switch discard drafts, logout invalidates old callbacks',
    (tester) async {
      final t = f.FakeTransport()
        ..handler = (_) async => f.ok({'items': [], 'nextCursor': null});
      final repo = RoomsRepository(
        ApiClient(
          transport: t,
          resolver: const NativeRoutes(),
          accessToken: () async => 'synthetic',
        ),
      );
      final a = RoomsCreateRecovery('a'), b = RoomsCreateRecovery('b');
      Widget screen(String id, RoomsCreateRecovery owner) => MaterialApp(
        home: RoomsScreen(
          accountId: id,
          createRecovery: owner,
          repository: repo,
          onSessionLost: () {},
        ),
      );
      await tester.pumpWidget(screen('a', a));
      await tester.pumpAndSettle();
      await tester.tap(find.text('새 여행방 만들기'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '초안');
      await tester.tap(find.byTooltip('목록으로'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, '목록으로'));
      await tester.pumpAndSettle();
      expect(a.unsentDraft, isNull);
      await tester.tap(find.text('새 여행방 만들기'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '다른 초안');
      await tester.pumpWidget(screen('b', b));
      await tester.pumpAndSettle();
      expect(a.unsentDraft, isNull);
      expect(find.text('다른 초안'), findsNothing);
      expect(find.text('내 여행방'), findsOneWidget);
      final generation = b.generation;
      b.clear();
      b.rememberDraft(generation, '오래된 입력', null, null);
      expect(b.unsentDraft, isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
  test('pending intent is not overwritten by mutable unsent draft and success clears both', () async {
    final t = f.FakeTransport();
    t.handler = (r) async => throw const ApiFailure(FailureKind.network);
    final repo = RoomsRepository(
      ApiClient(
        transport: t,
        resolver: const NativeRoutes(),
        accessToken: () async => 'synthetic',
      ),
      requestId: () => 'original',
    );
    final owner = RoomsCreateRecovery('a');
    owner.rememberDraft(owner.generation, '제출 제목', '2026-12-01', '2026-12-02');
    final c = RoomsController(repo, createRecovery: owner, accountId: 'a');
    await c.create('제출 제목', '2026-12-01', '2026-12-02');
    final body = t.requests.single.body;
    owner.rememberDraft(owner.generation, '오염 제목', null, null);
    expect(owner.unsentDraft!['title'], '제출 제목');
    expect(c.pendingDraft!['title'], '제출 제목');
    c.dispose();
    final next = RoomsController(repo, createRecovery: owner, accountId: 'a');
    t.handler = (_) async => f.ok(f.room());
    await next.create('다른 제목', null, null);
    expect(t.requests.last.body, body);
    expect(owner.unsentDraft, isNull);
    expect(next.pendingDraft, isNull);
    next.dispose();
  });
}
