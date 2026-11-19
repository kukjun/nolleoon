// Dedicated localprobe bundle only. No real Kakao identity/key/provider SDK.
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nolleoon_mobile/main.dart';
import 'package:nolleoon_mobile/auth/auth_repository.dart';
import 'package:nolleoon_mobile/auth/native_auth_backend.dart';
import 'package:nolleoon_mobile/auth/secure_session_store.dart';
import 'package:nolleoon_mobile/data/io_transport.dart';
import 'package:nolleoon_mobile/data/api_origin.dart';
import 'package:nolleoon_mobile/features/account_deletion/deletion_receipt_store.dart';

import '../test_targets/loopback_probe_policy.dart';
import '../test_targets/probe_actions.dart';

class SyntheticIdentity implements KakaoIdentity {
  @override
  bool get configured => true;
  @override
  Future<String> login() async => 'synthetic-provider-a';
  @override
  Future<void> clear() async {}
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('isolated native HTTP login create list logout', (tester) async {
    requireLoopbackProbe(
      enabled: const bool.fromEnvironment('NATIVE_LOOPBACK_TEST_BUILD'),
      origin: const String.fromEnvironment('NATIVE_LOOPBACK_ORIGIN'),
      bundleId: const String.fromEnvironment('NATIVE_PROBE_BUNDLE_ID'),
      debug: kDebugMode,
      ios: defaultTargetPlatform == TargetPlatform.iOS,
    );
    // Origin implementation namespaces these default keys. Never use this
    // target without the reviewed origin/storage-isolation dependency.
    final origin = ApiOrigin.configured;
    expect(origin.base.toString(), 'http://127.0.0.1:4188/');
    expect(
      origin.storageKey('nolleoon.native.session.v1'),
      isNot('nolleoon.native.session.v1'),
    );
    expect(
      origin.storageKey(SecureDeletionReceiptStore.key),
      isNot(SecureDeletionReceiptStore.key),
    );
    final store = SecureSessionStore();
    final receipts = SecureDeletionReceiptStore();
    await store.clear();
    await receipts.clear();
    final auth = AuthRepository(
      identity: SyntheticIdentity(),
      backend: NativeAuthBackend(transport: const IoApiTransport()),
      store: store,
    );
    addTearDown(() async {
      auth.dispose();
      await store.clear();
      await receipts.clear();
    });
    await tester.pumpWidget(
      MyApp(
        auth: auth,
        transport: const IoApiTransport(),
        deletionReceiptStore: receipts,
      ),
    );
    Future<void> visible(Finder finder) async {
      final until = DateTime.now().add(const Duration(seconds: 20));
      while (finder.evaluate().isEmpty && DateTime.now().isBefore(until)) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      expect(finder, findsWidgets);
    }

    await visible(find.text('카카오로 로그인'));
    await tapReadyProbeAction(
      tester,
      find.text('카카오로 로그인'),
      ready: () => auth.canLogin,
    );
    await visible(find.text('새 여행방 만들기'));
    expect(auth.phase, AuthPhase.signedIn);
    await tapReadyProbeAction(tester, find.text('새 여행방 만들기'));
    await tester.pump();
    final title =
        'Synthetic iOS loopback ${DateTime.now().millisecondsSinceEpoch}';
    await tester.enterText(find.byType(TextField).first, title);
    FocusManager.instance.primaryFocus?.unfocus();
    await tester.pump();
    await tapReadyProbeAction(tester, find.text('여행방 만들기'));
    await visible(find.text(title));
    await tapReadyProbeAction(
      tester,
      find
          .descendant(of: find.byTooltip('목록으로'), matching: find.byType(Icon))
          .first,
    );
    await tester.pump();
    await visible(find.text(title));
    await tapReadyProbeAction(tester, find.text('로그아웃'));
    await visible(find.text('카카오로 로그인'));
    expect(auth.phase, AuthPhase.signedOut);
    expect(await store.read(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
