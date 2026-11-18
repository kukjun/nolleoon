import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/features/rooms/rooms_controller.dart';
import 'package:nolleoon_mobile/features/rooms/rooms_repository.dart';
import 'package:nolleoon_mobile/features/rooms/rooms_screen.dart';

import 'rooms_test.dart' as f;

void main() {
  testWidgets(
    'old account discard dialog cannot erase new account restored draft',
    (t) async {
      final transport = f.FakeTransport()
        ..handler = (_) async => f.ok({'items': [], 'nextCursor': null});
      final repo = RoomsRepository(
        ApiClient(
          transport: transport,
          resolver: const NativeRoutes(),
          accessToken: () async => 'synthetic',
        ),
      );
      final a = RoomsCreateRecovery('a'), b = RoomsCreateRecovery('b');
      b.rememberDraft(b.generation, 'B private draft', null, null);
      Widget screen(String id, RoomsCreateRecovery owner) => MaterialApp(
        home: RoomsScreen(
          accountId: id,
          createRecovery: owner,
          repository: repo,
          onSessionLost: () {},
        ),
      );
      await t.pumpWidget(screen('a', a));
      await t.pumpAndSettle();
      await t.tap(find.text('새 여행방 만들기'));
      await t.pumpAndSettle();
      await t.enterText(find.byType(TextField), 'A draft');
      await t.tap(find.byTooltip('목록으로'));
      await t.pumpAndSettle();
      await t.pumpWidget(screen('b', b));
      await t.pumpAndSettle();
      if (find.widgetWithText(TextButton, '목록으로').evaluate().isNotEmpty) {
        await t.tap(find.widgetWithText(TextButton, '목록으로'));
        await t.pumpAndSettle();
      }
      expect(b.unsentDraft?['title'], 'B private draft');
      await t.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'background removes discard dialog and old callback cannot close a newer dialog',
    (t) async {
      final transport = f.FakeTransport()
        ..handler = (_) async => f.ok({'items': [], 'nextCursor': null});
      final repo = RoomsRepository(
        ApiClient(
          transport: transport,
          resolver: const NativeRoutes(),
          accessToken: () async => 'synthetic',
        ),
      );
      final owner = RoomsCreateRecovery('a');
      await t.pumpWidget(
        MaterialApp(
          home: RoomsScreen(
            accountId: 'a',
            createRecovery: owner,
            repository: repo,
            onSessionLost: () {},
          ),
        ),
      );
      await t.pumpAndSettle();
      await t.tap(find.text('새 여행방 만들기'));
      await t.pumpAndSettle();
      await t.enterText(find.byType(TextField), '보존할 초안');
      await t.tap(find.byTooltip('목록으로'));
      await t.pumpAndSettle();
      final old = t
          .widget<TextButton>(find.widgetWithText(TextButton, '목록으로'))
          .onPressed!;
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await t.pumpAndSettle();
      expect(find.text('목록으로 돌아갈까요?'), findsNothing);
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await t.pumpAndSettle();
      await t.tap(find.byTooltip('목록으로'));
      await t.pumpAndSettle();
      old();
      await t.pumpAndSettle();
      expect(find.text('목록으로 돌아갈까요?'), findsOneWidget);
      expect(owner.unsentDraft?['title'], '보존할 초안');
      await t.tap(find.text('계속 작성'));
      await t.pumpAndSettle();
      expect(find.text('보존할 초안'), findsOneWidget);
      await t.tap(find.byTooltip('목록으로'));
      await t.pumpAndSettle();
      await t.pumpWidget(const SizedBox());
      await t.pumpAndSettle();
      expect(find.text('목록으로 돌아갈까요?'), findsNothing);
      expect(owner.unsentDraft?['title'], '보존할 초안');
    },
  );
}
