// Test-target policy only. It must run before constructing stores or networking.
void requireLoopbackProbe({
  required bool enabled,
  required String origin,
  required String bundleId,
  required bool debug,
  required bool ios,
}) {
  if (!enabled ||
      !debug ||
      !ios ||
      origin != 'http://127.0.0.1:4188' ||
      bundleId != 'com.kukjun.nolleoon.localprobe') {
    throw StateError('Dedicated iOS loopback probe required');
  }
}
