import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Android plugin apply() is not a disk acknowledgement. The native handler
/// commits a non-secret marker to fixed plugin stores, without arbitrary args.
class NativeStorageCommitBarrier {
  static const channel = MethodChannel(
    'nolleoon/native_secure_storage_barrier',
  );
  static Future<void> flush() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
    try {
      final result = await channel
          .invokeMethod<Object?>('flush')
          .timeout(const Duration(seconds: 5));
      if (result != true) throw StateError('Storage commit unconfirmed');
    } catch (_) {
      // No plugin error payload, key, token or preference data escapes.
      throw StateError('Secure storage commit is unconfirmed');
    }
  }
}
