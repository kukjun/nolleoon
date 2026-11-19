import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nolleoon_mobile/main.dart';
import 'package:nolleoon_mobile/auth/auth_repository.dart';

import '../../auth_test.dart' as f;
import '../../receipt_fake.dart';
import 'feature_wiring_test.dart' as shell;

class LongNames extends shell.ShellTransport {
  @override
  Future<TransportResponse> send(
    TransportRequest request,
    CancellationToken cancel,
  ) async {
    final response = await super.send(request, cancel);
    final text = response.body.replaceAll('첫 사람', '아주 긴 한국어 이름을 가진 첫 번째 여행 친구');
    return TransportResponse(response.status, text);
  }
}

void main() {
  for (final spec in [(320.0, 568.0, 2.0), (390.0, 844.0, 1.6)]) {
    testWidgets('scoped menus, participant hierarchy and back ${spec.$1}', (
      tester,
    ) async {
      tester.view.physicalSize = Size(spec.$1, spec.$2);
      tester.view.devicePixelRatio = 1;
      tester.platformDispatcher.textScaleFactorTestValue = spec.$3;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      final auth = AuthRepository(
        identity: f.Provider(),
        backend: shell.ShellBackend(),
        store: f.Store(),
      );
      final t = LongNames();
      await tester.pumpWidget(
        MyApp(auth: auth, transport: t, deletionReceiptStore: ReceiptFake()),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('카카오로 로그인'));
      await tester.tap(find.text('카카오로 로그인'));
      await tester.pumpAndSettle();
      expect(find.text('내 프로필'), findsNothing);
      expect(find.text('계정 탈퇴'), findsNothing);
      final menuButton = tester.widget<TextButton>(
        find.widgetWithText(TextButton, '계정 메뉴'),
      );
      menuButton.onPressed!();
      menuButton.onPressed!();
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsNothing);
      await tester.tap(find.text('계정 메뉴'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('닫기'));
      await tester.pumpAndSettle();
      expect(find.text('계정 탈퇴'), findsNothing);
      await tester.tap(find.text('계정 메뉴'));
      await tester.pumpAndSettle();
      final staleProfile = tester
          .widget<TextButton>(find.widgetWithText(TextButton, '내 프로필'))
          .onPressed!;
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsNothing);
      staleProfile();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('합성 여행'),
        150,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('합성 여행'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('함께하는 사람 2명'),
        150,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('방 관리'), findsNothing);
      expect(
        tester.getTopLeft(find.text('함께하는 사람 2명')).dy,
        lessThan(tester.getTopLeft(find.text('게임 고르기')).dy),
      );
      await tester.scrollUntilVisible(
        find.text('방 더보기'),
        180,
        scrollable: find.byType(Scrollable).first,
      );
      await Scrollable.ensureVisible(
        tester.element(find.text('방 더보기')),
        alignment: .5,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('방 더보기'));
      await tester.pumpAndSettle();
      expect(find.text('게임 기록'), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('게임 기록'), findsNothing);
      expect(t.requests.where((r) => r.method != 'GET'), isEmpty);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      auth.dispose();
    });
  }
}
