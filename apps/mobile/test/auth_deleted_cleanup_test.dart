import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/auth/auth_repository.dart';

import 'auth_test.dart' as f;

class CleanupStore extends f.Store {
  bool fail = false;
  Completer<void>? pending;
  int clears = 0;
  @override
  Future<void> clear() async {
    clears++;
    if (pending != null) await pending!.future;
    if (fail) throw StateError('private');
    await super.clear();
  }
}

class SwitchedBackend extends f.Backend {
  String account = 'a';
  @override
  AuthSession get session => AuthSession(
    token: 'token-$account',
    expiresAt: DateTime.utc(2040),
    accountId: account,
    displayName: '합성',
  );
}

void main() {
  test(
    'confirmed deletion clears only local credentials without backend logout',
    () async {
      final store = CleanupStore();
      final backend = SwitchedBackend();
      final auth = AuthRepository(
        identity: f.Provider(),
        backend: backend,
        store: store,
      );
      await auth.login();
      await auth.clearDeletedAccount('a');
      expect(store.value, isNull);
      expect(auth.session, isNull);
      expect(auth.phase, AuthPhase.signedOut);
      expect(backend.logouts, 0);
      auth.dispose();
    },
  );
  test('failed cleanup retries locally and blocks concurrent login', () async {
    final store = CleanupStore();
    final backend = SwitchedBackend();
    final provider = f.Provider();
    final auth = AuthRepository(
      identity: provider,
      backend: backend,
      store: store,
    );
    await auth.login();
    store.fail = true;
    await expectLater(auth.clearDeletedAccount('a'), throwsStateError);
    expect(auth.canLogin, isFalse);
    expect(store.value, 'token-a');
    store.fail = false;
    store.pending = Completer<void>();
    final retry = auth.clearDeletedAccount('a');
    await Future<void>.delayed(Duration.zero);
    await auth.login();
    expect(provider.calls, 1);
    store.pending!.complete();
    await retry;
    expect(backend.logouts, 0);
    expect(auth.phase, AuthPhase.signedOut);
    auth.dispose();
  });
  test('old scope and replaced stored credential are never cleared', () async {
    final store = CleanupStore();
    final backend = SwitchedBackend();
    final auth = AuthRepository(
      identity: f.Provider(),
      backend: backend,
      store: store,
    );
    await auth.login();
    store.value = 'token-b';
    await expectLater(auth.clearDeletedAccount('a'), throwsStateError);
    expect(store.value, 'token-b');
    expect(store.clears, 0);
    backend.account = 'b';
    await auth.resume();
    await expectLater(auth.clearDeletedAccount('a'), throwsStateError);
    expect(auth.session!.accountId, 'b');
    expect(store.value, 'token-b');
    auth.dispose();
  });
}
