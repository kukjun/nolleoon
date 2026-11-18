import 'dart:async';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/features/account_deletion/deletion_receipt_store.dart';

class DelayedStorage extends FlutterSecureStorage {
  final entered = Completer<void>(), release = Completer<void>();
  bool delay = false;
  @override
  Future<void> write({
    required String key,
    required String? value,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    if (delay && value!.contains('pending')) {
      delay = false;
      entered.complete();
      await release.future;
    }
    await super.write(key: key, value: value);
  }
}

void main() {
  test(
    'clear queued across instances cannot be undone by an older pending write',
    () async {
      FlutterSecureStorage.setMockInitialValues({});
      final storage = DelayedStorage()..delay = true;
      final now = DateTime.fromMillisecondsSinceEpoch(1000000);
      final first = SecureDeletionReceiptStore(
        storage: storage,
        now: () => now,
      );
      final second = SecureDeletionReceiptStore(
        storage: storage,
        now: () => now,
      );
      final pending = DeletionReceipt.pending(
        accountScope: 'A',
        requestId: 'fixed',
        token: 'a' * 43,
        expiresAt: 2000000,
      );
      final writing = first.write(pending);
      await storage.entered.future;
      final clearing = second.clear();
      await Future<void>.delayed(const Duration(milliseconds: 20));
      storage.release.complete();
      await writing;
      await clearing;
      expect(await first.read(), isNull);
    },
  );
  test(
    'late pending write must not restore bearer after confirmed replacement',
    () async {
      FlutterSecureStorage.setMockInitialValues({});
      final storage = DelayedStorage();
      final now = DateTime.fromMillisecondsSinceEpoch(1000000);
      final store = SecureDeletionReceiptStore(
        storage: storage,
        now: () => now,
      );
      final pending = DeletionReceipt.pending(
        accountScope: 'A',
        requestId: 'fixed',
        token: 'a' * 43,
        expiresAt: 2000000,
      );
      await store.write(pending);
      storage.delay = true;
      final old = store.write(pending);
      await storage.entered.future;
      final second = SecureDeletionReceiptStore(
        storage: storage,
        now: () => now,
      );
      final confirmation = second.write(pending.confirmed());
      await Future<void>.delayed(const Duration(milliseconds: 20));
      storage.release.complete();
      await old;
      await confirmation;
      expect((await store.read())!.serverConfirmed, true);
      expect((await store.read())!.token, isNull);
    },
  );
}
