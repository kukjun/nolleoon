import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nolleoon_mobile/features/account_deletion/account_deletion.dart';
import 'package:nolleoon_mobile/features/account_deletion/account_deletion_screen.dart';

import 'deletion_test.dart' as f;

void main() {
  testWidgets(
    '320px explicit final confirmation; cancel does not send; success cleanup',
    (t) async {
      t.view.physicalSize = const Size(320, 900);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.resetPhysicalSize);
      addTearDown(t.view.resetDevicePixelRatio);
      final transport = f.Transport();
      final r = f.repository(transport), owner = DeletionRecovery('A');
      var cleanup = 0;
      await t.pumpWidget(
        MaterialApp(
          home: AccountDeletionScreen(
            repository: r,
            recovery: owner,
            onDeleted: (_) async {
              cleanup++;
            },
          ),
        ),
      );
      await t.scrollUntilVisible(find.text('탈퇴 최종 확인으로'), 300);
      await t.tap(find.text('탈퇴 최종 확인으로'));
      await t.pump();
      await t.scrollUntilVisible(
        find.text('취소'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await t.tap(find.text('취소'));
      await t.pump();
      expect(transport.requests, isEmpty);
      await t.tap(find.text('탈퇴 최종 확인으로'));
      await t.pump();
      await t.enterText(find.byType(TextField), '계정 탈퇴');
      await t.pump();
      await t.ensureVisible(find.text('계정 영구 탈퇴'));
      await t.tap(find.text('계정 영구 탈퇴'));
      await t.pumpAndSettle();
      expect(cleanup, 1);
      expect(find.text('계정 탈퇴와 기기 정보 정리를 완료했어요.'), findsOneWidget);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'same key account replacement clears confirmation and background never submits',
    (t) async {
      final a = f.Transport(), b = f.Transport(), owner = DeletionRecovery('A');
      final ra = f.repository(a), rb = f.repository(b, account: 'B');
      Widget screen(AccountDeletionRepository r) => MaterialApp(
        home: AccountDeletionScreen(
          repository: r,
          recovery: owner,
          onDeleted: (_) async {},
        ),
      );
      await t.pumpWidget(screen(ra));
      await t.scrollUntilVisible(find.text('탈퇴 최종 확인으로'), 300);
      await t.tap(find.text('탈퇴 최종 확인으로'));
      await t.pump();
      await t.enterText(find.byType(TextField), '계정 탈퇴');
      owner.bind('B');
      await t.pumpWidget(screen(rb));
      await t.pumpAndSettle();
      expect(find.byType(TextField), findsNothing);
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await t.pump();
      expect(find.text('탈퇴하면 되돌릴 수 없어요'), findsNothing);
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await t.pump();
      expect(a.requests, isEmpty);
      expect(b.requests, isEmpty);
      await t.pumpWidget(const SizedBox());
    },
  );
}
