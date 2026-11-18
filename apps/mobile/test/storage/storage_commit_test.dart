import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:nolleoon_mobile/auth/secure_session_store.dart';
import 'package:nolleoon_mobile/features/account_deletion/account_deletion.dart';

import '../features/account_deletion/deletion_test.dart' show Transport, token;

void main() {
  test(
    'true barrier without matching session readback is not success',
    () async {
      FlutterSecureStorage.setMockInitialValues({});
      final store = SecureSessionStore(
        commitBarrier: () async {
          await const FlutterSecureStorage().write(
            key: 'nolleoon.native.session.v1',
            value: 'different-synthetic',
          );
        },
      );
      await expectLater(store.write(token), throwsStateError);
      await expectLater(store.clear(), throwsStateError);
    },
  );
  test(
    'session write/delete wait for barrier and failure is not success',
    () async {
      FlutterSecureStorage.setMockInitialValues({});
      var gate = Completer<void>();
      var finished = false;
      final store = SecureSessionStore(commitBarrier: () => gate.future);
      final write = store.write(token).then((_) {
        finished = true;
      });
      await Future<void>.delayed(Duration.zero);
      expect(finished, false);
      gate.complete();
      await write;
      expect(finished, true);
      gate = Completer<void>();
      finished = false;
      final clear = store.clear();
      final check = expectLater(clear, throwsStateError);
      gate.completeError(StateError('synthetic'));
      await check;
      expect(finished, false);
    },
  );
  test('pending failed barrier means destructive POST zero; ack barrier failure means cleanup incomplete', () async {
    FlutterSecureStorage.setMockInitialValues({});
    var calls = 0;
    var failAt = 1;
    final store = SecureDeletionReceiptStore(
      commitBarrier: () async {
        calls++;
        if (calls == failAt) throw StateError('synthetic');
      },
    );
    final transport = Transport();
    final repo = AccountDeletionRepository(
      accountScope: 'A',
      token: token,
      transport: transport,
      receiptStore: store,
      expiresAt: DateTime.now()
          .add(const Duration(days: 1))
          .millisecondsSinceEpoch,
      requestId: () => 'fixed',
    );
    var cleaned = 0;
    final controller = AccountDeletionController(
      repo,
      DeletionRecovery('A'),
      onDeleted: (_) async {
        cleaned++;
      },
    );
    await controller.confirm('계정 탈퇴');
    expect(transport.requests, isEmpty);
    expect(controller.complete, false);
    failAt = 3;
    await controller.retry();
    expect(transport.requests.length, 1);
    expect(controller.deleted, true);
    expect(controller.complete, false);
    expect(cleaned, 0);
    failAt = 999;
    await controller.retry();
    expect(transport.requests.length, 1);
    expect(controller.complete, true);
    controller.dispose();
  });
}
