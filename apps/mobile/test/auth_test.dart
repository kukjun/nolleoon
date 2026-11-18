import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/auth/auth_repository.dart';

class Store implements SessionStore {
  String? value;
  int writes = 0;
  @override
  Future<String?> read() async => value;
  @override
  Future<void> write(String token) async {
    value = token;
    writes++;
  }

  @override
  Future<void> clear() async {
    value = null;
  }
}

class Provider implements KakaoIdentity {
  bool enabled = true;
  int calls = 0;
  bool cancelled = false;
  Completer<String>? pending;
  @override
  bool get configured => enabled;
  @override
  Future<String> login() async {
    calls++;
    if (cancelled) throw const LoginCancelled();
    return pending == null ? 'sdk-synthetic' : pending!.future;
  }

  @override
  Future<void> clear() async {}
}

class Backend implements AuthBackend {
  int exchanges = 0, probes = 0, logouts = 0;
  bool expired = false, offline = false;
  AuthSession get session => AuthSession(
    token: 'synthetic-bearer',
    expiresAt: DateTime.utc(2040),
    accountId: 'a',
    displayName: '테스트',
  );
  @override
  Future<AuthSession> exchange(String token) async {
    exchanges++;
    return session;
  }

  @override
  Future<AuthSession> probe(String token) async {
    probes++;
    if (expired) throw const SessionExpired();
    if (offline) throw StateError('private');
    return session;
  }

  @override
  Future<void> logout(String token) async {
    logouts++;
    if (offline) throw StateError('private');
  }
}

void main() {
  late Store store;
  late Provider provider;
  late Backend backend;
  late AuthRepository auth;
  setUp(() {
    store = Store();
    provider = Provider();
    backend = Backend();
    auth = AuthRepository(identity: provider, backend: backend, store: store);
  });
  tearDown(() => auth.dispose());
  test('missing key never invokes SDK or exchange', () async {
    provider.enabled = false;
    await auth.login();
    expect(auth.phase, AuthPhase.unavailable);
    expect(provider.calls, 0);
    expect(store.writes, 0);
  });
  test('cancel keeps signed out, never exchanges', () async {
    provider.cancelled = true;
    await auth.login();
    expect(auth.phase, AuthPhase.signedOut);
    expect(backend.exchanges, 0);
  });
  test('duplicate login and resume cannot race provider return', () async {
    provider.pending = Completer();
    final first = auth.login();
    await auth.login();
    await auth.resume();
    expect(provider.calls, 1);
    expect(backend.probes, 0);
    provider.pending!.complete('sdk-synthetic');
    await first;
    expect(auth.phase, AuthPhase.signedIn);
    expect(store.value, 'synthetic-bearer');
    expect(backend.exchanges, 1);
  });
  test(
    'probe expired clears bearer; network failure does not claim signed in',
    () async {
      store.value = 'synthetic';
      backend.offline = true;
      await auth.resume();
      expect(auth.phase, AuthPhase.error);
      expect(store.value, 'synthetic');
      backend.offline = false;
      backend.expired = true;
      await auth.resume();
      expect(auth.phase, AuthPhase.signedOut);
      expect(store.value, null);
    },
  );
  test('logout server failure retains token for explicit retry but removes UI session', () async {
    await auth.login();
    backend.offline = true;
    await auth.logout();
    expect(auth.phase, AuthPhase.logoutFailed);
    expect(auth.session, null);
    expect(store.value, isNotNull);
    backend.offline = false;
    await auth.logout();
    expect(auth.phase, AuthPhase.signedOut);
    expect(store.value, null);
  });
  test('disposed login return cannot persist a new bearer', () async {
    provider.pending = Completer();
    final pending = auth.login();
    auth.dispose();
    provider.pending!.complete('sdk-synthetic');
    await pending;
    expect(store.value, null);
    expect(backend.exchanges, 0);
  });
}
