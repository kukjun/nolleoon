import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/auth/auth_repository.dart';

import 'auth_test.dart' as f;

void main() {
  test('confirmed bootstrap receipt cleans matching credential with zero remote calls', () async {
    final store = f.Store()..value = 'a' * 43;
    final backend = f.Backend();
    final auth = AuthRepository(
      identity: f.Provider(),
      backend: backend,
      store: store,
    );
    await auth.clearDeletedReceipt(
      accountScope: 'a',
      tokenDigest: sha256.convert(utf8.encode('a' * 43)).toString(),
    );
    expect(store.value, isNull);
    expect(backend.probes, 0);
    expect(backend.logouts, 0);
    expect(backend.exchanges, 0);
    expect(auth.session, isNull);
    expect(auth.phase, AuthPhase.signedOut);
    auth.dispose();
  });
  test('mismatched receipt never clears different stored identity', () async {
    final store = f.Store()..value = 'b' * 43;
    final backend = f.Backend();
    final auth = AuthRepository(
      identity: f.Provider(),
      backend: backend,
      store: store,
    );
    await expectLater(
      auth.clearDeletedReceipt(
        accountScope: 'a',
        tokenDigest: sha256.convert(utf8.encode('a' * 43)).toString(),
      ),
      throwsStateError,
    );
    expect(store.value, 'b' * 43);
    expect(backend.probes, 0);
    expect(backend.logouts, 0);
    auth.dispose();
  });
  test('tokenless cleanup retry does not invent a session', () async {
    final auth = AuthRepository(
      identity: f.Provider(),
      backend: f.Backend(),
      store: f.Store(),
    );
    await auth.clearDeletedReceipt(
      accountScope: 'a',
      tokenDigest: sha256.convert(utf8.encode('a' * 43)).toString(),
    );
    expect(auth.session, isNull);
    expect(auth.phase, AuthPhase.signedOut);
    auth.dispose();
  });
  test(
    'new verified same-account credential is not removed by older receipt',
    () async {
      final store = f.Store();
      final backend = f.Backend();
      final auth = AuthRepository(
        identity: f.Provider(),
        backend: backend,
        store: store,
      );
      await auth.login();
      await expectLater(
        auth.clearDeletedReceipt(
          accountScope: 'a',
          tokenDigest: sha256.convert(utf8.encode('a' * 43)).toString(),
        ),
        throwsStateError,
      );
      expect(auth.phase, AuthPhase.signedIn);
      expect(store.value, 'synthetic-bearer');
      expect(backend.logouts, 0);
      auth.dispose();
    },
  );
}
