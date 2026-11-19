import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';

/// One destination policy shared by JSON, authentication and avatar traffic.
/// Test overrides are debug-only literal loopback, never public staging/DNS.
final class ApiOrigin {
  ApiOrigin._(this.base);
  final Uri base;
  static ApiOrigin get configured {
    const flag = String.fromEnvironment('NATIVE_LOOPBACK_TEST_BUILD');
    if (!{'', 'true', 'false'}.contains(flag)) {
      throw ArgumentError('Invalid test build flag');
    }
    return ApiOrigin.fromConfiguration(
      testBuild: flag == 'true',
      value: const String.fromEnvironment('NATIVE_LOOPBACK_ORIGIN'),
    );
  }

  factory ApiOrigin.fromConfiguration({
    bool testBuild = false,
    String value = '',
    bool releaseBuild = false,
  }) {
    if (!testBuild) {
      if (value.isNotEmpty) throw ArgumentError('Test origin requires opt-in');
      return ApiOrigin._(Uri.parse('https://nolleoon.kukjun.com/'));
    }
    // releaseBuild can strengthen a test check, never bypass actual build mode.
    if (!kDebugMode || releaseBuild || value.isEmpty) {
      throw ArgumentError('Loopback requires a configured debug test build');
    }
    final uri = Uri.tryParse(value);
    if (uri == null ||
        !{'http', 'https'}.contains(uri.scheme) ||
        !{'127.0.0.1', '::1'}.contains(uri.host) ||
        !uri.hasPort ||
        uri.port < 1 ||
        uri.port > 65535 ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment ||
        (uri.path.isNotEmpty && uri.path != '/')) {
      throw ArgumentError('Unapproved loopback origin');
    }
    return ApiOrigin._(uri.replace(path: '/'));
  }

  String storageKey(String productionKey) =>
      base.toString() == 'https://nolleoon.kukjun.com/'
      ? productionKey
      : '$productionKey.loopback.${sha256.convert(utf8.encode(base.toString()))}';

  bool allows(Uri uri) =>
      uri.scheme == base.scheme &&
      uri.host == base.host &&
      uri.port == base.port &&
      uri.userInfo.isEmpty &&
      !uri.hasFragment;
}
