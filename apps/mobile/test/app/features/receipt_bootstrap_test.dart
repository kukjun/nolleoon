import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nolleoon_mobile/main.dart';
import 'package:nolleoon_mobile/auth/auth_repository.dart';
import 'package:nolleoon_mobile/features/account_deletion/deletion_receipt_store.dart';

import '../../auth_test.dart' as f;
import '../../receipt_fake.dart';
import 'feature_wiring_test.dart' as shell;

DeletionReceipt receipt() => DeletionReceipt.pending(
  accountScope: 'account-a',
  requestId: 'fixed-receipt',
  token: 'a' * 43,
  expiresAt: DateTime.now().add(const Duration(days: 2)).millisecondsSinceEpoch,
);

class HeldProbe extends shell.ShellBackend {
  Completer<AuthSession>? held;
  @override
  Future<AuthSession> probe(String token) async =>
      held == null ? super.probe(token) : held!.future;
}

void main() {
  for (final confirmed in [false, true]) {
    testWidgets(
      'bootstrap ${confirmed ? 'confirmed cleanup' : 'pending receipt'} waits for explicit retry without login',
      (tester) async {
        final store = f.Store()..value = 'a' * 43;
        final backend = shell.ShellBackend();
        final auth = AuthRepository(
          identity: f.Provider(),
          backend: backend,
          store: store,
        );
        final receipts = ReceiptFake()
          ..value = confirmed ? receipt().confirmed() : receipt();
        final transport = shell.ShellTransport();
        await tester.pumpWidget(
          MyApp(
            auth: auth,
            transport: transport,
            deletionReceiptStore: receipts,
          ),
        );
        await tester.pumpAndSettle();
        expect(backend.probes, 0);
        expect(transport.deletions, 0);
        expect(find.text('카카오로 로그인'), findsNothing);
        final label = confirmed ? '기기 정보 정리 다시 시도' : '같은 탈퇴 요청 다시 확인';
        await tester.scrollUntilVisible(
          find.text(label),
          200,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.tap(find.text(label));
        await tester.pumpAndSettle();
        expect(transport.deletions, confirmed ? 0 : 1);
        expect(backend.logouts, 0);
        expect(store.value, isNull);
        expect(receipts.value, isNull);
        expect(find.text('계정 탈퇴와 기기 정보 정리를 완료했어요.'), findsOneWidget);
        await tester.pumpWidget(const SizedBox.shrink());
        auth.dispose();
      },
    );
  }
  testWidgets('invalid receipt blocks automatic auth and POST', (tester) async {
    final backend = shell.ShellBackend();
    final store = f.Store()..value = 'a' * 43;
    final auth = AuthRepository(
      identity: f.Provider(),
      backend: backend,
      store: store,
    );
    final transport = shell.ShellTransport();
    final receipts = ReceiptFake()..failRead = true;
    await tester.pumpWidget(
      MyApp(auth: auth, transport: transport, deletionReceiptStore: receipts),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('자동 로그인과 재전송을 중단'), findsOneWidget);
    expect(backend.probes, 0);
    expect(transport.requests, isEmpty);
    expect(store.value, 'a' * 43);
    await tester.pumpWidget(const SizedBox.shrink());
    auth.dispose();
  });
  testWidgets('confirmed old receipt never clears a newer local credential', (
    tester,
  ) async {
    final store = f.Store()..value = 'b' * 43;
    final backend = shell.ShellBackend();
    final receipts = ReceiptFake()..value = receipt().confirmed();
    final auth = AuthRepository(
      identity: f.Provider(),
      backend: backend,
      store: store,
    );
    final transport = shell.ShellTransport();
    await tester.pumpWidget(
      MyApp(auth: auth, transport: transport, deletionReceiptStore: receipts),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('기기 정보 정리 다시 시도'));
    await tester.pumpAndSettle();
    expect(store.value, 'b' * 43);
    expect(receipts.value, isNotNull);
    expect(transport.deletions, 0);
    expect(backend.probes, 0);
    expect(find.text('카카오로 로그인'), findsNothing);
    await tester.pumpWidget(const SizedBox.shrink());
    auth.dispose();
  });
  testWidgets(
    'unconfirmed deletion is hidden until same account revalidation',
    (tester) async {
      final backend = HeldProbe();
      final auth = AuthRepository(
        identity: f.Provider(),
        backend: backend,
        store: f.Store(),
      );
      final transport = shell.ShellTransport();
      await tester.pumpWidget(
        MyApp(
          auth: auth,
          transport: transport,
          deletionReceiptStore: ReceiptFake(),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('카카오로 로그인'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('계정 메뉴'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('계정 탈퇴'));
      await tester.pumpAndSettle();
      expect(find.text('탈퇴 최종 확인으로'), findsOneWidget);
      backend.held = Completer<AuthSession>();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pump();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      expect(find.text('탈퇴 최종 확인으로'), findsNothing);
      expect(find.text('계정 영구 탈퇴'), findsNothing);
      expect(transport.deletions, 0);
      backend.held!.complete(backend.session);
      await tester.pumpAndSettle();
      expect(find.text('탈퇴 최종 확인으로'), findsOneWidget);
      expect(transport.deletions, 0);
      await tester.pumpWidget(const SizedBox.shrink());
      auth.dispose();
    },
  );
  testWidgets(
    'invalid receipt explicit two-step device reset waits for every cleanup',
    (tester) async {
      final backend = shell.ShellBackend();
      final store = f.Store()..value = 'b' * 43;
      final receipts = ReceiptFake()
        ..failRead = true
        ..failClear = true;
      final auth = AuthRepository(
        identity: f.Provider(),
        backend: backend,
        store: store,
      );
      final transport = shell.ShellTransport();
      await tester.pumpWidget(
        MyApp(auth: auth, transport: transport, deletionReceiptStore: receipts),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('이 기기의 복구 정보 정리'));
      await tester.pumpAndSettle();
      expect(store.value, 'b' * 43);
      await tester.tap(find.text('취소'));
      await tester.pumpAndSettle();
      expect(store.value, 'b' * 43);
      await tester.tap(find.text('이 기기의 복구 정보 정리'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('이 기기 정보만 지우고 다시 시작'));
      await tester.pumpAndSettle();
      expect(store.value, isNull);
      expect(find.text('카카오로 로그인'), findsNothing);
      expect(find.textContaining('정리를 끝내지 못했어요'), findsOneWidget);
      receipts.failClear = false;
      await tester.tap(find.text('이 기기 정보만 지우고 다시 시작'));
      await tester.pumpAndSettle();
      expect(find.text('카카오로 로그인'), findsOneWidget);
      expect(receipts.clears, 1);
      expect(backend.logouts, 0);
      expect(backend.probes, 0);
      expect(transport.requests, isEmpty);
      await tester.pumpWidget(const SizedBox.shrink());
      auth.dispose();
    },
  );
}
