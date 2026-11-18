import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/features/account_deletion/account_deletion.dart';

class Transport implements ApiTransport {
  final requests = <TransportRequest>[];
  Future<TransportResponse> Function(TransportRequest)? handler;
  @override
  Future<TransportResponse> send(
    TransportRequest r,
    CancellationToken c,
  ) async {
    requests.add(r);
    return handler == null
        ? const TransportResponse(200, '{"deleted":true}')
        : handler!(r);
  }
}

String get token => List.filled(43, 'a').join();
AccountDeletionRepository repository(Transport t, {String account = 'A'}) =>
    AccountDeletionRepository(
      accountScope: account,
      token: token,
      transport: t,
      requestId: () => 'synthetic-delete-id',
    );
void main() {
  test('explicit logout clear invalidates old same-account controller and late receipt', () async {
    final t = Transport(), held = Completer<TransportResponse>();
    t.handler = (_) => held.future;
    final owner = DeletionRecovery('A');
    var cleanup = 0;
    final c = AccountDeletionController(
      repository(t),
      owner,
      onDeleted: (_) async {
        cleanup++;
      },
    );
    final work = c.confirm('계정 탈퇴');
    await Future<void>.delayed(Duration.zero);
    owner.clear();
    held.complete(const TransportResponse(200, '{"deleted":true}'));
    await work;
    await c.confirm('계정 탈퇴');
    expect(cleanup, 0);
    expect(t.requests.length, 1);
    c.dispose();
  });

  test(
    'explicit confirmation only; exact native POST and strict receipt',
    () async {
      final t = Transport(), owner = DeletionRecovery('A');
      var cleanups = 0;
      final c = AccountDeletionController(
        repository(t),
        owner,
        onDeleted: (_) async {
          cleanups++;
        },
      );
      await c.confirm('탈퇴');
      expect(t.requests, isEmpty);
      await c.confirm('계정 탈퇴');
      expect(t.requests.single.uri.path, '/api/native/account/delete');
      expect(t.requests.single.method, 'POST');
      expect(jsonDecode(t.requests.single.body!), {
        'requestId': 'synthetic-delete-id',
        'confirmation': '계정 탈퇴',
      });
      expect(t.requests.single.headers['Authorization'], 'Bearer $token');
      expect(
        t.requests.single.headers.keys.any((k) => k.toLowerCase() == 'cookie'),
        false,
      );
      expect(cleanups, 1);
      expect(c.complete, true);
      c.dispose();
    },
  );
  test('lost response survives remount; same bytes and original credential, no auto resend', () async {
    final t = Transport()
      ..handler = (_) async => throw const ApiFailure(FailureKind.network);
    final owner = DeletionRecovery('A');
    var c = AccountDeletionController(
      AccountDeletionRepository(
        accountScope: 'A',
        token: List.filled(43, 'b').join(),
        transport: t,
        requestId: () => 'must-not-use-new-id',
      ),
      owner,
      onDeleted: (_) async {},
    );
    await c.confirm('계정 탈퇴');
    c.dispose();
    c = AccountDeletionController(
      repository(t),
      owner,
      onDeleted: (_) async {},
    );
    expect(t.requests.length, 1);
    expect(c.pending, true);
    t.handler = (_) async => const TransportResponse(200, '{"deleted":true}');
    await c.retry();
    expect(t.requests.length, 2);
    expect(t.requests[1].body, t.requests[0].body);
    expect(t.requests[1].headers, t.requests[0].headers);
    expect(c.complete, true);
    c.dispose();
  });
  test('background and account replacement suppress late completion and old dispatch', () async {
    final t = Transport(), held = Completer<TransportResponse>();
    t.handler = (_) => held.future;
    final owner = DeletionRecovery('A');
    var cleanups = 0;
    final c = AccountDeletionController(
      repository(t),
      owner,
      onDeleted: (_) async {
        cleanups++;
      },
    );
    final work = c.confirm('계정 탈퇴');
    await Future<void>.delayed(Duration.zero);
    c.setForeground(false);
    owner.bind('B');
    held.complete(const TransportResponse(200, '{"deleted":true}'));
    await work;
    c.setForeground(true);
    await c.retry();
    await c.confirm('계정 탈퇴');
    expect(cleanups, 0);
    expect(t.requests.length, 1);
    c.dispose();
  });
  test('receipt committed before cleanup; failed cleanup retries locally, not network', () async {
    final t = Transport();
    var n = 0;
    final c = AccountDeletionController(
      repository(t),
      DeletionRecovery('A'),
      onDeleted: (_) async {
        if (n++ == 0) throw StateError('synthetic');
      },
    );
    await c.confirm('계정 탈퇴');
    expect(c.deleted, true);
    expect(c.complete, false);
    await c.retry();
    expect(t.requests.length, 1);
    expect(c.complete, true);
    c.dispose();
  });
  test('invalid receipt and conflict never claim deletion', () async {
    for (final response in [
      const TransportResponse(200, '{"deleted":false}'),
      const TransportResponse(200, '{"deleted":true,"subject":"synthetic"}'),
      const TransportResponse(409, '{"code":"STATE_CONFLICT"}'),
    ]) {
      final t = Transport()..handler = (_) async => response;
      var deleted = false;
      final c = AccountDeletionController(
        repository(t),
        DeletionRecovery('A'),
        onDeleted: (_) async {
          deleted = true;
        },
      );
      await c.confirm('계정 탈퇴');
      expect(deleted, false);
      expect(c.deleted, false);
      expect(c.error, isNotNull);
      c.dispose();
    }
  });
  test(
    'duplicate taps share one command and identity mismatch is rejected',
    () async {
      final t = Transport(), held = Completer<TransportResponse>();
      t.handler = (_) => held.future;
      final owner = DeletionRecovery('A');
      expect(
        () => AccountDeletionController(
          repository(t, account: 'B'),
          owner,
          onDeleted: (_) async {},
        ),
        throwsArgumentError,
      );
      final c = AccountDeletionController(
        repository(t),
        owner,
        onDeleted: (_) async {},
      );
      final work = c.confirm('계정 탈퇴');
      await c.confirm('계정 탈퇴');
      await Future<void>.delayed(Duration.zero);
      expect(t.requests.length, 1);
      held.complete(const TransportResponse(200, '{"deleted":true}'));
      await work;
      c.dispose();
    },
  );
}
