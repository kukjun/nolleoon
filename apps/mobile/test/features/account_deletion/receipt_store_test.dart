import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/features/account_deletion/deletion_receipt_store.dart';

void main() {
  final now = DateTime.fromMillisecondsSinceEpoch(1000000);
  final token = List.filled(43, 'a').join();
  DeletionReceipt receipt() => DeletionReceipt.pending(
    accountScope: 'account-A',
    requestId: 'request-123',
    token: token,
    expiresAt: 2000000,
  );
  test('confirmed retains only original token digest and v1/tampering fails closed', () {
    final pending = jsonDecode(receipt().encode()) as Map<String, dynamic>;
    final confirmed =
        jsonDecode(receipt().confirmed().encode()) as Map<String, dynamic>;
    expect(pending['version'], 2);
    expect(pending['tokenDigest'], matches(RegExp(r'^[a-f0-9]{64}$')));
    expect(confirmed['tokenDigest'], pending['tokenDigest']);
    expect(confirmed.containsKey('token'), false);
    expect(
      () => DeletionReceipt.decode(
        jsonEncode({...pending, 'tokenDigest': '0' * 64}),
        now: now,
      ),
      throwsFormatException,
    );
    expect(
      () => DeletionReceipt.decode(
        jsonEncode({...pending, 'version': 1}),
        now: now,
      ),
      throwsFormatException,
    );
  });
  test('secure adapter process reconstruction, monotonic phase, mismatch and clear', () async {
    FlutterSecureStorage.setMockInitialValues({});
    final first = SecureDeletionReceiptStore(now: () => now);
    await first.write(receipt());
    final second = SecureDeletionReceiptStore(now: () => now);
    expect((await second.read())!.token, token);
    await expectLater(
      second.write(
        DeletionReceipt.pending(
          accountScope: 'other',
          requestId: 'other',
          token: token,
          expiresAt: 2000000,
        ),
      ),
      throwsStateError,
    );
    await second.write((await second.read())!.confirmed());
    await expectLater(first.write(receipt()), throwsStateError);
    final raw = await const FlutterSecureStorage().read(
      key: SecureDeletionReceiptStore.key,
    );
    expect(raw, isNot(contains(token)));
    await second.clear();
    expect(await first.read(), isNull);
    FlutterSecureStorage.setMockInitialValues({
      SecureDeletionReceiptStore.key: 'invalid',
    });
    await expectLater(first.read(), throwsFormatException);
    // Invalid receipt is an explicit bootstrap block, never silently logged in.
    await first.clear();
    expect(await first.read(), isNull);
  });
  test(
    'strict bounded envelope retains original expiry and no confirmed token',
    () {
      final restored = DeletionReceipt.decode(receipt().encode(), now: now);
      expect(restored.token, token);
      expect(restored.expiresAt, 2000000);
      expect(restored.toString(), isNot(contains(token)));
      expect(restored.confirmed().token, isNull);
      expect(restored.confirmed().encode(), isNot(contains(token)));
      expect(
        DeletionReceipt.decode(
          restored.confirmed().encode(),
          now: now,
        ).serverConfirmed,
        isTrue,
      );
    },
  );
  test('malformed expired unknown and mixed credentials fail closed', () {
    final valid = jsonDecode(receipt().encode()) as Map<String, dynamic>;
    for (final invalid in [
      {...valid, 'extra': true},
      {...valid, 'expiresAt': 1000000},
      {...valid, 'expiresAt': 1000000 + 31 * 86400000},
      {...valid, 'token': 'bad'},
      {...valid, 'phase': 'confirmed'},
      {...valid, 'accountScope': ''},
      {...valid, 'requestId': '../request'},
    ]) {
      expect(
        () => DeletionReceipt.decode(jsonEncode(invalid), now: now),
        throwsFormatException,
      );
    }
    expect(
      () => DeletionReceipt.decode('x' * 4097, now: now),
      throwsFormatException,
    );
  });
}
