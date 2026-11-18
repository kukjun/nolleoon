import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/features/account_deletion/account_deletion.dart';

import 'deletion_test.dart' show Transport, token;

class MemoryReceipt implements DeletionReceiptStore {
  DeletionReceipt? value;
  bool failPending = false, failConfirmed = false, failClear = false;
  @override
  Future<DeletionReceipt?> read() async => value;
  @override
  Future<void> write(DeletionReceipt receipt) async {
    if (receipt.serverConfirmed ? failConfirmed : failPending) {
      throw StateError('Storage unavailable');
    }
    value = receipt;
  }

  @override
  Future<void> clear() async {
    if (failClear) throw StateError('Storage unavailable');
    value = null;
  }
}

AccountDeletionRepository repo(Transport t, MemoryReceipt s) =>
    AccountDeletionRepository(
      accountScope: 'A',
      token: token,
      transport: t,
      requestId: () => 'same-request',
      receiptStore: s,
      expiresAt: DateTime.now()
          .add(const Duration(days: 29))
          .millisecondsSinceEpoch,
    );
void main() {
  test('storage failure blocks POST; process restoration only retries original immutable receipt explicitly', () async {
    final t = Transport(), s = MemoryReceipt()..failPending = true;
    final c = AccountDeletionController(
      repo(t, s),
      DeletionRecovery('A'),
      onDeleted: (_) async {},
    );
    await c.confirm('계정 탈퇴');
    expect(t.requests, isEmpty);
    expect(c.complete, false);
    s.failPending = false;
    t.handler = (_) async => throw const ApiFailure(FailureKind.network);
    await c.retry();
    expect(t.requests.length, 1);
    expect(s.value!.token, token);
    final original = t.requests.single;
    c.dispose();
    final restored = DeletionRecovery.restore(s.value!, transport: t, store: s);
    final next = AccountDeletionController(
      restored.pendingRepository!,
      restored,
      onDeleted: (_) async {},
    );
    expect(t.requests.length, 1);
    t.handler = null;
    await next.retry();
    expect(t.requests.length, 2);
    expect(t.requests.last.body, original.body);
    expect(t.requests.last.headers, original.headers);
    expect(jsonDecode(t.requests.last.body!)['requestId'], 'same-request');
    expect(next.complete, true);
    expect(s.value, isNull);
    next.dispose();
  });
  test('ACK then failed tokenless write retains confirmed memory and never repeats POST', () async {
    final t = Transport(), s = MemoryReceipt()..failConfirmed = true;
    var cleanup = 0;
    final c = AccountDeletionController(
      repo(t, s),
      DeletionRecovery('A'),
      onDeleted: (_) async {
        cleanup++;
      },
    );
    await c.confirm('계정 탈퇴');
    expect(t.requests.length, 1);
    expect(c.deleted, true);
    expect(c.complete, false);
    expect(cleanup, 0);
    s.failConfirmed = false;
    s.failClear = true;
    await c.retry();
    expect(t.requests.length, 1);
    expect(s.value!.token, isNull);
    expect(s.value!.serverConfirmed, true);
    expect(c.complete, false);
    c.dispose();
    final restored = DeletionRecovery.restore(s.value!, transport: t, store: s);
    final next = AccountDeletionController(
      restored.pendingRepository!,
      restored,
      onDeleted: (_) async {
        cleanup++;
      },
    );
    s.failClear = false;
    await next.retry();
    expect(t.requests.length, 1);
    expect(next.complete, true);
    expect(s.value, isNull);
    next.dispose();
  });
  test('restored receipt cannot attach to a different account controller', () {
    final s = MemoryReceipt(), t = Transport();
    final value = DeletionReceipt.pending(
      accountScope: 'A',
      requestId: 'request',
      token: token,
      expiresAt: DateTime.now()
          .add(const Duration(days: 1))
          .millisecondsSinceEpoch,
    );
    final restored = DeletionRecovery.restore(value, transport: t, store: s);
    expect(
      () => AccountDeletionController(
        AccountDeletionRepository(
          accountScope: 'B',
          token: token,
          transport: t,
        ),
        restored,
        onDeleted: (_) async {},
      ),
      throwsArgumentError,
    );
    expect(t.requests, isEmpty);
  });
}
