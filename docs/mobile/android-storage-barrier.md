# Android secure receipt flush 설계 검토 (코드 변경 전)

확인일 2026-11-18 UTC. 설치 flutter_secure_storage11.2.0 소스와 Android 공식 reference/AOSP를 읽었다. 실제 Android/저장된 값은 접근하지 않았다.

## 공식 근거와 empty commit 한계

- https://developer.android.com/reference/android/content/SharedPreferences.Editor : apply는 메모리를 즉시 바꾸고 disk failure를 알리지 않는다. 같은 SharedPreferences의 뒤 commit은 앞 apply와 자신의 write를 기다린다. 반환 false는 성공으로 취급하지 않는다.
- https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/core/java/android/app/SharedPreferencesImpl.java : commit은 latch 후 writeToDiskResult 반환, enqueueDiskWrite는 같은 prefs 쓰기 순서를 처리한다. generation 기반 최신 구현은 저장된 generation을 확인한다.
- https://android.googlesource.com/platform/frameworks/base/+/android-7.0.0_r1/core/java/android/app/SharedPreferencesImpl.java : API24 구현은 writeToFile 571–577에서 파일이 존재하고 changesMade=false이면 디스크를 다시 쓰지 않고 true. 앞 apply의 rename 실패(581–586)로 오래된 파일이 남아도 뒤 empty commit이 true가 될 수 있다. 따라서 wait 의미와 이전 작업의 성공 검증은 다르다. 원본은 official ?format=TEXT에서 내려받아 /tmp/aosp-api24-SharedPreferencesImpl.java에 보존했다.
- 앱 minSdk는 flutter.minSdkVersion이며 고정 Flutter3.50.0 FlutterExtension.kt:26은 24다. API24를 무시하는 설계를 할 수 없다.

## 현재 정확한 namespace
앱 두 store는 AndroidOptions 기본값으로 storageNamespace=null.
1. FlutterSecureStorage : encrypted payload(session/receipt), MigrationBackup의 _BACKUP 항목도 같은 prefs.
2. FlutterSecureKeyStorage : wrapped app key.
3. FlutterSecureStorageConfiguration:FlutterSecureStorage : 현재 algorithm/migration markers.
4. FlutterSecureStorageConfiguration : legacy fallback config.
근거: FlutterSecureStorageConfig.java16/183–195, NamespacedConfigSource.java15/20–34, FlutterSecureStorage.java263–267, MigrationBackup.java backup method. namespaced mode는 별도 이름이므로 앱이 옵션을 바꾸면 이 계약을 함께 변경해야 한다. AndroidKeyStore key는 SharedPreferences barrier 대상이 아니며 plugin/OS native storage API를 그대로 이용한다.

## 추천 최소 보완
- 앱 전용 no-arg MethodChannel, background single executor. 사용자가 넘긴 파일명/키/값을 받아 임의 prefs에 쓰는 API 금지.
- 위 fixed prefs의 각 editor에 앱 reserved 비식별 barrier marker를 매번 다른 값으로 putString하고 commit true를 요구한다. marker는 plugin credential key-prefix를 포함하지 않게 하여 payload readAll 및 데이터 migration의 credential 열거와 섞이지 않게 한다. 이는 모든 migration 경로에서 제외된다는 뜻은 아니다. empty commit만 하는 설계는 사용하지 않는다.
- 새 암호화 없음. secret plaintext/ciphertext/token을 custom channel로 읽거나 전달하지 않는다. 키/config 먼저, data 마지막 순서. 네 prefs 전체 atomic transaction은 아니므로 실패하면 성공 주장하지 않는다.
- Dart secure receipt write/delete 후 barrier await → 기존 readback 검증, 이 구간을 현재 store static serialization 안에 둔다. 누락/false/throw/timeout은 POST 전 중단 또는 ACK 이후 cleanup-only 미완료로 남긴다.
- 로그인 session clear 역시 barrier를 적용해야 cleanup 완료가 삭제된 세션 disk 복구 가능성을 남기지 않는다. 새로그인/session 쓰기와 receipt 쓰기는 앱 수준 조율이 필요하다.
- native worker에서 timeout이 나도 진행 중 commit을 취소했다고 가정하지 않는다. 후속작업은 같은 executor/queue로만 처리, 완료를 불명 상태로 취급한다.

## 추가 source 위험
AndroidOptions.dart 기본 resetOnError=true인 반면 앱은 명시 override하지 않는다. FlutterSecureStorage.java1042–1062/1323–1344에서 오류 시 자동 삭제/retry 경로가 존재한다. receipt가 손상/키불일치일 때 null로 사라져 정상 로그인 흐름에 복귀하는 것을 막으려면 두 app store의 AndroidOptions(resetOnError:false)를 명시하는 보완도 필요하다. 이는 barrier와 별개 failclosed 옵션이며 운영 값을 읽지 않았다.

## 한계와 게이트
- 같은 process/SharedPreferences 객체의 앞선 writes에 대한 보완이지 multi-process/isolates/future plugin writers 전체 동기화가 아니다. 앱은 단일 writer/isolate 규약을 유지하고 채널 namespace/version을 고정해야 한다.
- API24 + 최신API native fault injection: apply 후 지연, rename/write/commit 실패, false, channel미구현, ACK 후 cleanup실패, force-stop/relaunch, reboot/backuprestore를 실제로 확인해야 한다.
- Dart mock에서 POST0/cleanup 미완료를 검증할 수 있지만 native bytecode/OS fsync/강제종료 검증을 대신하지 않는다. 현재 Android SDK/JDK 미구성으로 native 빌드/기기 게이트는 계속 미완료다.

## 이번 구현 (#210, native source만)

`SecureStorageBarrier.kt`는 위 fixed prefs 4곳을 process-global single executor로 순회한다. marker는 plugin의 Base64 credential prefix와 겹치지 않는 `__nolleoon_storage_barrier_v1__`이며 값은 process UUID + 단조 증가 sequence이다. Long overflow는 실패하고, prefs마다 commit false/예외는 generic error로만 반환한다. 앱의 plaintext/session/receipt 값은 읽거나 채널로 받지 않는다. plugin 11.2.0의 readAll/deleteAll 및 데이터 migration은 credential prefix를 가진 key만 다루므로 이 marker를 암호문으로 복호화하지 않는다. 다만 MigrationBackup.java:130–137의 wrapped-key 백업은 keyStorage의 모든 String 항목을 _BACKUP으로 복사하므로 keyStorage의 marker도 백업·복원 대상이다. 이를 자격증명이나 복호화 대상 키로 해석하지 않으며 다음 barrier는 새 marker를 기록한다. 따라서 모든 migration에서 marker가 제외된다고 주장하지 않는다. Marker와 그 백업은 기존 sharedpref backup exclusion에 포함되는 비식별 보조 메타데이터다.

채널 `nolleoon/native_secure_storage_barrier`, method `flush`, arguments=null, 성공=true. MainActivity가 엔진 설정에서 등록하고 정리 때 handler를 해제한다. 이미 실행 중인 commit을 activity detach/timeout으로 취소했다고 주장하지 않는다. 후속 요청은 동일 executor에 직렬화된다. UUID는 marker 충돌 회피용이며 새로운 자격증명/암호화 방식이 아니다.

Dart 쪽 receipt/session await, readback, resetOnError:false, 오류 UI는 별도 구현이다. 모든 caller가 저장 완료 후 flush를 기다려야 하고 향후 다른 isolate/process 또는 저장 namespace 추가는 재검토해야 한다. 이 executor는 plugin 자체의 미래 쓰기를 전역 잠그지 않는다.

검증은 Node source-contract 4개로만 수행했다(누락 source RED → source contract GREEN). 고정 이름/채널/인자 거부/commit 변경/serial executor/민감 getter 부재/앱 등록/의존 버전 pin을 검사한다. 이는 Kotlin 문법/Android API 호환/OS 파일 쓰기/강제종료 성공을 검증하지 않는다. Android SDK/JDK 미구성 상태에서 빌드를 실행하거나 설치/라이선스를 변경하지 않았으며 #210 native release gate는 열린 상태다.
