import 'dart:convert';

import 'package:crypto/crypto.dart';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../auth/storage_commit_barrier.dart';

/// Only a fixed original deletion request, never a renewable login credential.
class DeletionReceipt {
  const DeletionReceipt._(
    this.accountScope,
    this.requestId,
    this.expiresAt,
    this.token,
    this.serverConfirmed,
    this.tokenDigest,
  );
  factory DeletionReceipt.pending({
    required String accountScope,
    required String requestId,
    required String token,
    required int expiresAt,
  }) => DeletionReceipt._(
    accountScope,
    requestId,
    expiresAt,
    token,
    false,
    sha256.convert(utf8.encode(token)).toString(),
  );
  final String accountScope, requestId, tokenDigest;
  final int expiresAt;
  final String? token;
  final bool serverConfirmed;
  DeletionReceipt confirmed() => DeletionReceipt._(
    accountScope,
    requestId,
    expiresAt,
    null,
    true,
    tokenDigest,
  );
  String encode() => jsonEncode({
    'version': 2,
    'tokenDigest': tokenDigest,
    'accountScope': accountScope,
    'requestId': requestId,
    'expiresAt': expiresAt,
    'phase': serverConfirmed ? 'confirmed' : 'pending',
    if (!serverConfirmed) 'token': token,
  });
  static DeletionReceipt decode(String raw, {required DateTime now}) {
    if (raw.length > 4096) {
      throw const FormatException('Invalid deletion receipt');
    }
    dynamic map;
    try {
      map = jsonDecode(raw);
    } catch (_) {
      throw const FormatException('Invalid deletion receipt');
    }
    if (map is! Map<String, dynamic>) {
      throw const FormatException('Invalid deletion receipt');
    }
    final confirmed = map['phase'] == 'confirmed';
    final keys = {
      'version',
      'tokenDigest',
      'accountScope',
      'requestId',
      'expiresAt',
      'phase',
      if (!confirmed) 'token',
    };
    final account = map['accountScope'],
        request = map['requestId'],
        expiry = map['expiresAt'];
    if (map.length != keys.length ||
        !map.keys.every(keys.contains) ||
        map['version'] != 2 ||
        map['tokenDigest'] is! String ||
        !RegExp(r'^[a-f0-9]{64}$').hasMatch(map['tokenDigest'] as String) ||
        !{'confirmed', 'pending'}.contains(map['phase']) ||
        account is! String ||
        !RegExp(r'^[A-Za-z0-9_-]{1,128}$').hasMatch(account) ||
        request is! String ||
        !RegExp(r'^[A-Za-z0-9_-]{1,100}$').hasMatch(request) ||
        expiry is! int ||
        expiry <= now.millisecondsSinceEpoch ||
        expiry > now.millisecondsSinceEpoch + 30 * 86400000 ||
        (!confirmed &&
            (map['token'] is! String ||
                !RegExp(r'^[A-Za-z0-9_-]{43}$')
                    .hasMatch(map['token'] as String) ||
                sha256
                        .convert(utf8.encode(map['token'] as String))
                        .toString() !=
                    map['tokenDigest']))) {
      throw const FormatException('Invalid deletion receipt');
    }
    return DeletionReceipt._(
      account,
      request,
      expiry,
      confirmed ? null : map['token'] as String,
      confirmed,
      map['tokenDigest'] as String,
    );
  }

  @override
  String toString() => 'DeletionReceipt(redacted)';
}

abstract interface class DeletionReceiptStore {
  Future<DeletionReceipt?> read();
  Future<void> write(DeletionReceipt receipt);
  Future<void> clear();
}

/// Same device-only Keychain policy as the native session store. Android app
/// backup exclusions remain required; this adapter never uses preferences.
class SecureDeletionReceiptStore implements DeletionReceiptStore {
  SecureDeletionReceiptStore({
    FlutterSecureStorage? storage,
    DateTime Function()? now,
    Future<void> Function()? commitBarrier,
  }) : _storage =
           storage ??
           const FlutterSecureStorage(
             aOptions: AndroidOptions(resetOnError: false),
             iOptions: IOSOptions(
               accessibility: KeychainAccessibility.first_unlock_this_device,
             ),
           ),
       _now = now ?? DateTime.now,
       _commitBarrier = commitBarrier ?? NativeStorageCommitBarrier.flush;
  final FlutterSecureStorage _storage;
  final DateTime Function() _now;
  final Future<void> Function() _commitBarrier;
  static const key = 'nolleoon.native.deletion-receipt.v1';
  // One queue for this key across remounted adapter instances in this isolate.
  // Root owns a single store; no background isolate writes are supported.
  static Future<void> _tail = Future<void>.value();
  static Future<T> _serialized<T>(Future<T> Function() operation) {
    final result = _tail.then((_) => operation());
    _tail = result.then<void>((_) {}, onError: (Object _, StackTrace _) {});
    return result;
  }

  @override
  Future<DeletionReceipt?> read() => _serialized(_read);
  Future<DeletionReceipt?> _read() async {
    final raw = await _storage.read(key: key);
    if (raw == null) return null;
    // Invalid/expired data is not silently accepted as permission to log in.
    // Caller must resolve the error and clear stored login before a fresh flow.
    return DeletionReceipt.decode(raw, now: _now());
  }

  @override
  Future<void> write(DeletionReceipt receipt) =>
      _serialized(() => _write(receipt));
  Future<void> _write(DeletionReceipt receipt) async {
    final raw = receipt.encode();
    DeletionReceipt.decode(raw, now: _now());
    final existing = await _read();
    if (existing != null &&
        (existing.accountScope != receipt.accountScope ||
            existing.requestId != receipt.requestId ||
            existing.expiresAt != receipt.expiresAt ||
            existing.tokenDigest != receipt.tokenDigest ||
            (!existing.serverConfirmed &&
                !receipt.serverConfirmed &&
                existing.token != receipt.token) ||
            (existing.serverConfirmed && !receipt.serverConfirmed))) {
      throw StateError('Unresolved deletion receipt');
    }
    await _storage.write(key: key, value: raw);
    await _commitBarrier();
    if (await _storage.read(key: key) != raw) {
      throw StateError('Deletion receipt not saved');
    }
  }

  @override
  Future<void> clear() => _serialized(_clear);
  Future<void> _clear() async {
    await _storage.delete(key: key);
    await _commitBarrier();
    if (await _storage.read(key: key) != null) {
      throw StateError('Deletion receipt not cleared');
    }
  }
}
