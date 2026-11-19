import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:nolleoon_mobile/auth/secure_session_store.dart';
import 'package:nolleoon_mobile/data/api_origin.dart';
import 'package:nolleoon_mobile/features/account_deletion/deletion_receipt_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('production and each loopback origin isolate both bearer and unresolved receipt; clear never migrates or deletes others', () async {
    FlutterSecureStorage.setMockInitialValues({});
    final prod = ApiOrigin.fromConfiguration();
    final verification = ApiOrigin.fromConfiguration(
      verificationBuild: true,
      value: 'http://127.0.0.1:4100',
    );
    final a = ApiOrigin.fromConfiguration(
      testBuild: true,
      value: 'http://127.0.0.1:4100',
    );
    final b = ApiOrigin.fromConfiguration(
      testBuild: true,
      value: 'http://127.0.0.1:4101',
    );
    SecureSessionStore session(ApiOrigin o) =>
        SecureSessionStore(origin: o, commitBarrier: () async {});
    SecureDeletionReceiptStore receipts(ApiOrigin o) =>
        SecureDeletionReceiptStore(
          origin: o,
          commitBarrier: () async {},
          now: () => DateTime.fromMillisecondsSinceEpoch(1000),
        );
    DeletionReceipt receipt(String id) => DeletionReceipt.pending(
      accountScope: id,
      requestId: 'request1',
      token: 'A' * 43,
      expiresAt: 100000,
    );
    await session(prod).write('synthetic-production');
    await receipts(prod).write(receipt('production'));
    expect(await session(a).read(), isNull);
    expect(await receipts(a).read(), isNull);
    await session(a).write('synthetic-a');
    await receipts(a).write(receipt('a'));
    expect(await session(b).read(), isNull);
    expect(await receipts(b).read(), isNull);
    expect(await session(verification).read(), isNull);
    expect(await receipts(verification).read(), isNull);
    await session(verification).write('synthetic-verification');
    await receipts(verification).write(receipt('verification'));
    await session(verification).clear();
    await receipts(verification).clear();
    expect(await session(a).read(), 'synthetic-a');
    expect((await receipts(a).read())!.accountScope, 'a');
    await session(a).clear();
    await receipts(a).clear();
    expect(await session(prod).read(), 'synthetic-production');
    expect((await receipts(prod).read())!.accountScope, 'production');
    expect(await session(a).read(), isNull);
    expect(await receipts(a).read(), isNull);
    expect(
      await const FlutterSecureStorage().read(
        key: 'nolleoon.native.session.v1',
      ),
      'synthetic-production',
    );
    expect(
      await const FlutterSecureStorage().read(
        key: SecureDeletionReceiptStore.key,
      ),
      isNotNull,
    );
  });
}
