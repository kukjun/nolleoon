import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'auth_repository.dart';
import 'storage_commit_barrier.dart';

/// Native app bearer only. Never use plain preferences or shared web cookies.
class SecureSessionStore implements SessionStore {
  SecureSessionStore({
    FlutterSecureStorage? storage,
    Future<void> Function()? commitBarrier,
  }) : _storage =
           storage ??
           const FlutterSecureStorage(
             aOptions: AndroidOptions(resetOnError: false),
             iOptions: IOSOptions(
               accessibility: KeychainAccessibility.first_unlock_this_device,
             ),
           ),
       _commitBarrier = commitBarrier ?? NativeStorageCommitBarrier.flush;
  final FlutterSecureStorage _storage;
  final Future<void> Function() _commitBarrier;
  static const _key = 'nolleoon.native.session.v1';
  @override
  Future<String?> read() => _storage.read(key: _key);
  @override
  Future<void> write(String token) async {
    await _storage.write(key: _key, value: token);
    await _commitBarrier();
    if (await _storage.read(key: _key) != token) {
      throw StateError('Secure session write is unconfirmed');
    }
  }

  @override
  Future<void> clear() async {
    await _storage.delete(key: _key);
    await _commitBarrier();
    if (await _storage.read(key: _key) != null) {
      throw StateError('Secure session deletion is unconfirmed');
    }
  }
}
