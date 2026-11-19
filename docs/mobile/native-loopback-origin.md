# Debug-only loopback API destination

Implemented 2026-11-19. This is preparation, not proof of real Kakao/native-network integration.

Normal builds retain `https://nolleoon.kukjun.com`. An explicitly configured debug build may use:

```
--dart-define=NATIVE_LOOPBACK_TEST_BUILD=true
--dart-define=NATIVE_LOOPBACK_ORIGIN=http://127.0.0.1:42519
```

Both values must be consistent. Missing/invalid origin in test mode, an origin without opt-in, malformed boolean, and any test override in profile/release fail closed. No fallback to production occurs. Only literal `127.0.0.1` or `[::1]` with explicit valid port and HTTP/HTTPS is accepted; localhost DNS, Android host alias 10.0.2.2, public staging, credentials, paths, query and fragments are rejected. No TLS override is provided. Redirects remain disabled.

`ApiClient`, `AvatarClient` and `IoApiTransport` all default to the same immutable compile-time policy. This also covers auth exchange/session/logout, room/game/history and deletion callers without requiring each feature to manually propagate a URL. Dependency-injected policies use the same validation. The transport independently rejects any other origin/port.

Session and deletion-receipt keys retain their exact production names in normal builds. Test keys add `.loopback.<SHA256 canonical origin>` so existing production credentials/receipts are never read, migrated or cleared by test mode, and changing local port/scheme creates a distinct namespace. The fixed encrypted preferences files, keychain accessibility, resetOnError=false, commit barrier and serialized receipt operations are unchanged. This is not an authorization to use real tokens in synthetic tests. Separate test application IDs are additional platform defense, implemented separately.

Verification uses real host loopback `HttpServer` sockets with synthetic values, not a mock transport: configured JSON/auth/room/avatar destinations, wrong-port rejection and no redirect forwarding. Secure-storage namespace assertions use the plugin's test backend, not real keychain values. No adb reverse, ATS/cleartext relaxation, production API call, credentials or real Kakao login are performed here. Android/iOS platform networking readiness remains a separate gate. Invitation share links remain production links; no new local-link acceptance rule is introduced.
