import 'package:flutter_test/flutter_test.dart';

import '../../test_targets/loopback_probe_policy.dart';

void main() {
  test('dedicated debug iOS loopback accepted; absent flags and production rejected', () {
    void check({
      bool enabled = true,
      String origin = 'http://127.0.0.1:4188',
      String bundleId = 'com.example.nolleoonMobile.localprobe',
      bool debug = true,
      bool ios = true,
    }) => requireLoopbackProbe(
      enabled: enabled,
      origin: origin,
      bundleId: bundleId,
      debug: debug,
      ios: ios,
    );
    check();
    expect(() => check(enabled: false), throwsStateError);
    expect(
      () => check(origin: 'https://nolleoon.kukjun.com'),
      throwsStateError,
    );
    expect(() => check(origin: 'http://localhost:4188'), throwsStateError);
    expect(
      () => check(bundleId: 'com.example.nolleoonMobile'),
      throwsStateError,
    );
    expect(() => check(debug: false), throwsStateError);
    expect(() => check(ios: false), throwsStateError);
  });
}
