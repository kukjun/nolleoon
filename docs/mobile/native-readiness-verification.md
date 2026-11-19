# Native login preparation verification

Source tested: `7698582` (2026-11-19). This is preparation for real Kakao testing, not production deployment or store acceptance.

## Observed results

- Full Flutter suite: **274 PASS**, analyzer clean.
- Focused Node source/API tests: **10 PASS**. Python generator/probe-driver tests: **8 PASS**.
- Independent code review covered origin policy, credential namespaces, synthetic staging, native callback configuration, approved IDs and journey fixtures; no blocking findings remained.
- Android debug APK built with approved `com.kukjun.nolleoon`; artifact inspected with aapt and certificate inspected with apksigner. Existing debug certificate retained, no signing identity generated or changed.
- iOS standard/off build and synthetic callback/on localprobe build succeeded. Initial generated module conflict from concurrent Flutter test/build in one worktree was resolved by serial regeneration and rebuild, not by changing app dependencies or permission settings.
- Actual iPhone 17 / iOS 26.4 simulator journey: **1/1 PASS**, build 27.4 seconds, journey 2 seconds. A scratch archive of the tested source set only the host build's bundle ID to `com.kukjun.nolleoon.localprobe`; final built Info.plist was inspected. Compile-time loopback config remained mandatory. Real native HTTP and Keychain APIs communicated with a fresh loopback Nest/SQLite fixture. Synthetic identity only: login → room creation → room list → logout → local session absent.

Earlier journey failures were test harness issues: tapping the visible but disabled login button before asynchronous readiness, using widget-test keyboard registration in an integration test, duplicate title/action text, nested Material3 icon button matching, and asserting logout before completion. Corrections wait for actual enabled UI and verified state without bypassing product guards. No ATS/cleartext relaxation, adb reverse, remote staging or TLS override was used. Temporary diagnostic preflight separately passed Keychain write/clear and HTTP exchange/logout; diagnostic decorators are not part of the final target.

## Still not verified

Real Kakao SDK callback and account authentication, device-installed Kakao fallback/cancellation, physical devices, backup restore, production backend native activation, release signing, App/Play store requirements and remote CI. Synthetic server explicitly rejects real provider tokens and cannot prove same-app real account matching. Broader acceptance issues remain open.

## Next owner setup

Use the existing Kakao developer app used by the web service, not a new app. Register Android package `com.kukjun.nolleoon` with the actual debug certificate key hash supplied privately, and iOS bundle `com.kukjun.nolleoon`. Do not register `.localprobe` solely for these synthetic tests. Native app key goes only into the approved local native build inputs; numeric Kakao app ID goes into a separately approved real-verification backend. Never place REST secret/Admin key in Flutter defines or the app bundle. Actual console registration and private input remain pending; the code does not assert they happened.

## Preservation and rollback

Normal API destination and existing production storage keys stay unchanged. Test credentials are scoped by canonical loopback origin; test app IDs are separate. Existing temporary-ID app data is neither migrated nor deleted. Tests use disposable server storage only and stop the fixture normally. Rollback is to rebuild the prior code; no production DB migration or service restart is part of this change. Process-local Xcode tool selection avoids changing global xcode-select.
