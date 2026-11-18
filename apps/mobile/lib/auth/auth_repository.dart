import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';

// Secrets deliberately have no custom toString and are never part of UI state.
class AuthSession {
  const AuthSession({
    required this.token,
    required this.expiresAt,
    required this.accountId,
    required this.displayName,
  });
  final String token, accountId, displayName;
  final DateTime expiresAt;
}

abstract interface class SessionStore {
  Future<String?> read();
  Future<void> write(String token);
  Future<void> clear();
}

abstract interface class KakaoIdentity {
  bool get configured;
  Future<String> login();
  Future<void> clear();
}

abstract interface class AuthBackend {
  Future<AuthSession> exchange(String kakaoAccessToken);
  Future<AuthSession> probe(String bearer);
  Future<void> logout(String bearer);
}

class LoginCancelled implements Exception {
  const LoginCancelled();
}

class SessionExpired implements Exception {
  const SessionExpired();
}

enum AuthPhase { signedOut, unavailable, busy, signedIn, error, logoutFailed }

/// Serializes lifecycle probes with login callbacks. No cookie emulation, refresh,
/// automatic sign-in retries or persistence of provider tokens.
class AuthRepository extends ChangeNotifier {
  AuthRepository({
    required this.identity,
    required this.backend,
    required this.store,
  });
  final KakaoIdentity identity;
  final AuthBackend backend;
  final SessionStore store;
  AuthPhase phase = AuthPhase.signedOut;
  AuthSession? session;
  String? _lastVerifiedAccount, _lastVerifiedToken;
  bool _busy = false, _disposed = false;
  bool _sessionUnresolved = false;
  bool get hasUnresolvedSession => _sessionUnresolved;
  bool get canLogin =>
      identity.configured &&
      !_sessionUnresolved &&
      !_busy &&
      phase != AuthPhase.signedIn &&
      phase != AuthPhase.logoutFailed;
  void _state(AuthPhase value) {
    if (_disposed) return;
    phase = value;
    notifyListeners();
  }

  Future<void> login() async {
    if (_busy ||
        _disposed ||
        _sessionUnresolved ||
        phase == AuthPhase.signedIn ||
        phase == AuthPhase.logoutFailed) {
      return;
    }
    if (!identity.configured) {
      _state(AuthPhase.unavailable);
      return;
    }
    _busy = true;
    session = null;
    _state(AuthPhase.busy);
    AuthSession? issued;
    try {
      // Resolve existing ownership before starting another provider identity.
      _sessionUnresolved = true;
      final existing = await store.read();
      if (_disposed) return;
      if (existing != null) {
        _state(AuthPhase.error);
        return;
      }
      _sessionUnresolved = false;
      final providerToken = await identity.login();
      if (_disposed) return;
      issued = await backend.exchange(providerToken);
      if (_disposed) {
        await backend.logout(issued.token);
        return;
      }
      await store.write(issued.token);
      _sessionUnresolved = true;
      if (_disposed) {
        await store.clear();
        await backend.logout(issued.token);
        return;
      }
      session = issued;
      _lastVerifiedAccount = issued.accountId;
      _lastVerifiedToken = issued.token;
      _state(AuthPhase.signedIn);
    } on LoginCancelled {
      _state(AuthPhase.signedOut);
    } catch (_) {
      if (issued != null) {
        try {
          await store.clear();
        } catch (_) {}
        try {
          await backend.logout(issued.token);
        } catch (_) {}
      }
      _state(AuthPhase.error);
    } finally {
      try {
        await identity.clear();
      } catch (_) {}
      _busy = false;
    }
  }

  Future<void> resume() async {
    if (_busy || _disposed || phase == AuthPhase.logoutFailed) return;
    _busy = true;
    session = null;
    _state(AuthPhase.busy);
    try {
      _sessionUnresolved = true;
      final token = await store.read();
      if (_disposed) return;
      if (token == null) {
        _sessionUnresolved = false;
        _state(AuthPhase.signedOut);
        return;
      }
      final result = await backend.probe(token);
      if (_disposed) return;
      if (!result.expiresAt.isAfter(DateTime.now())) {
        throw const SessionExpired();
      }
      session = result;
      _lastVerifiedAccount = result.accountId;
      _lastVerifiedToken = result.token;
      _state(AuthPhase.signedIn);
    } on SessionExpired {
      try {
        await store.clear();
        _sessionUnresolved = false;
        _state(AuthPhase.signedOut);
      } catch (_) {
        _state(AuthPhase.error);
      }
    } catch (_) {
      _state(AuthPhase.error);
    } finally {
      _busy = false;
    }
  }

  Future<void> logout() async {
    if (_busy || _disposed) return;
    _busy = true;
    session = null;
    _state(AuthPhase.busy);
    try {
      final token = await store.read();
      if (token != null) {
        try {
          await backend.logout(token);
        } on SessionExpired {
          /* already invalid */
        }
      }
      await store.clear();
      _sessionUnresolved = false;
      await identity.clear();
      _state(AuthPhase.signedOut);
    } catch (_) {
      _state(AuthPhase.logoutFailed);
    } finally {
      _busy = false;
    }
  }

  /// Only after a verified server deletion receipt. No remote logout/unlink.
  /// Retain scope proof on failure so the same local cleanup can be retried.
  Future<void> clearDeletedAccount(String accountScope) async {
    if (_disposed ||
        _busy ||
        accountScope != _lastVerifiedAccount ||
        (session != null && session!.accountId != accountScope)) {
      throw StateError('Deletion cleanup ownership is unavailable');
    }
    _busy = true;
    try {
      final stored = await store.read();
      if (_disposed || (stored != null && stored != _lastVerifiedToken)) {
        throw StateError('Stored credential ownership changed');
      }
      session = null;
      _sessionUnresolved = true;
      _state(AuthPhase.busy);
      await store.clear();
      await identity.clear();
      _lastVerifiedAccount = null;
      _lastVerifiedToken = null;
      _sessionUnresolved = false;
      _state(AuthPhase.signedOut);
    } catch (_) {
      if (!_disposed) {
        session = null;
        _sessionUnresolved = true;
        _state(AuthPhase.error);
      }
      throw StateError('Local deletion cleanup is incomplete');
    } finally {
      _busy = false;
    }
  }

  /// Only a strictly parsed, non-expired confirmed secure receipt may call this.
  /// The digest binds cleanup to the original credential without restoring auth.
  Future<void> clearDeletedReceipt({
    required String accountScope,
    required String tokenDigest,
  }) async {
    if (_disposed ||
        _busy ||
        accountScope.trim().isEmpty ||
        !RegExp(r'^[a-f0-9]{64}$').hasMatch(tokenDigest) ||
        (session != null &&
            (session!.accountId != accountScope ||
                sha256.convert(utf8.encode(session!.token)).toString() !=
                    tokenDigest))) {
      throw StateError('Receipt cleanup ownership unavailable');
    }
    _busy = true;
    var started = false;
    try {
      final stored = await store.read();
      if (_disposed ||
          (stored != null &&
              sha256.convert(utf8.encode(stored)).toString() != tokenDigest)) {
        throw StateError('Receipt credential does not match');
      }
      started = true;
      session = null;
      _sessionUnresolved = true;
      _state(AuthPhase.busy);
      await store.clear();
      await identity.clear();
      _lastVerifiedAccount = null;
      _lastVerifiedToken = null;
      _sessionUnresolved = false;
      _state(AuthPhase.signedOut);
    } catch (_) {
      if (started && !_disposed) {
        session = null;
        _sessionUnresolved = true;
        _state(AuthPhase.error);
      }
      throw StateError('Receipt local cleanup is incomplete');
    } finally {
      _busy = false;
    }
  }

  /// User-confirmed device-only recovery for a malformed/expired receipt.
  /// Does not assert that server account deletion succeeded.
  Future<void> discardLocalIdentityForReceiptRecovery({
    required String confirmation,
  }) async {
    if (_disposed || _busy || confirmation != 'CLEAR_LOCAL_AUTH') {
      throw StateError('Explicit local recovery required');
    }
    _busy = true;
    session = null;
    _sessionUnresolved = true;
    _state(AuthPhase.busy);
    try {
      await store.clear();
      await identity.clear();
      _lastVerifiedAccount = null;
      _lastVerifiedToken = null;
      _sessionUnresolved = false;
      _state(AuthPhase.signedOut);
    } catch (_) {
      if (!_disposed) _state(AuthPhase.error);
      throw StateError('Local recovery is incomplete');
    } finally {
      _busy = false;
    }
  }

  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    super.dispose();
  }
}
