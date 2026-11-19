import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nolleoon_mobile/main.dart';
import 'package:nolleoon_mobile/auth/auth_repository.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/features/account_deletion/account_deletion.dart';

import '../auth_test.dart' as fakes;
import '../receipt_fake.dart';
import 'app_flow_test.dart' show Transport;

void main() {
  const verification = bool.fromEnvironment('NATIVE_KAKAO_VERIFICATION_BUILD');
  testWidgets(
    'verification banner and deletion entry policy before receipt creation',
    (tester) async {
      final auth = AuthRepository(
        identity: fakes.Provider(),
        backend: fakes.Backend(),
        store: fakes.Store(),
      );
      final receipts = ReceiptFake();
      final transport = Transport();
      await tester.pumpWidget(
        MyApp(auth: auth, transport: transport, deletionReceiptStore: receipts),
      );
      await tester.pumpAndSettle();
      expect(
        find.textContaining('카카오 연동 확인용'),
        verification ? findsOneWidget : findsNothing,
      );
      if (verification) {
        final banner = find
            .ancestor(
              of: find.textContaining('카카오 연동 확인용'),
              matching: find.byType(Material),
            )
            .first;
        expect(
          tester.getSize(banner).width,
          tester.view.physicalSize.width / tester.view.devicePixelRatio,
        );
      }
      if (verification) {
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        tester.view.devicePixelRatio = 1;
        for (final width in [320.0, 390.0]) {
          tester.view.physicalSize = Size(width, 800);
          await tester.pumpAndSettle();
          final banner = find
              .ancestor(
                of: find.textContaining('카카오 연동 확인용'),
                matching: find.byType(Material),
              )
              .first;
          expect(tester.getSize(banner).width, width);
          expect(tester.takeException(), isNull);
        }
      }
      await tester.tap(find.text('카카오로 로그인'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('계정 메뉴'));
      await tester.pumpAndSettle();
      expect(find.text('계정 탈퇴'), verification ? findsNothing : findsOneWidget);
      if (verification) {
        final repo = AccountDeletionRepository(
          accountScope: 'synthetic',
          token: 'A' * 43,
          transport: transport,
          receiptStore: receipts,
          expiresAt: DateTime.utc(2040).millisecondsSinceEpoch,
        );
        final before = transport.lists;
        await expectLater(
          repo.execute(repo.prepare(), CancellationToken()),
          throwsStateError,
        );
        expect(receipts.writes, 0);
        expect(transport.lists, before);
      }
      await tester.pumpWidget(const SizedBox());
      auth.dispose();
    },
  );
}
