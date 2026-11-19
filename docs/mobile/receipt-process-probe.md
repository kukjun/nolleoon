# #210 Android process-death probe

계획/범위와 실제 실행 기록을 구분한다. 아래 실행 기록 전에는 host unit·analyze 결과만 있었으며, 실제 API36 검증은 마지막 절에 별도 기록했다.

## 격리와 실행

새 전용 AVD `nolleoon_receipt_probe_api<API번호>`만 사용한다. 기존 emulator/물리기기/사용자 설치는 금지한다. `tools/mobile/prepare-receipt-probe.sh`는 현재 커밋을 새 임시폴더에 archive하여 그 복사본 debug에만 `.receiptprobe` applicationIdSuffix를 넣는다. 원본 Gradle/main은 수정하지 않는다.

그 복사본의 apps/mobile에서 `flutter build apk --debug --target test_targets/receipt_process_probe.dart`로만 빌드한다. package는 `com.kukjun.nolleoon.receiptprobe`. production main을 target으로 빌드한 APK를 전달하면 안 된다. release pipeline은 이 target을 참조하지 않는다.

`python3 tools/mobile/run-receipt-probe.py --adb <SDK adb> --aapt <동일 SDK build-tools aapt> --serial emulator-<번호> --apk <전용 target APK>`

명시 serial/QEMU/전용 AVD명/해당 package 미설치 및 APK package/debuggable을 확인한 뒤 한 번 설치한다. 실제 SecureSessionStore/SecureDeletionReceiptStore/native barrier만 사용하며 AuthBackend·HTTP·로그인·운영 API는 조립하지 않는다. 합성 account/request/token만 사용한다. 비밀 값은 args/log/UI에 출력하지 않는다. 단계는 FlutterActivity 기본 `route` intent extra로 전달하고 같은 합성 원래 세션 expiry(30일 이내)를 매번 비교한다.

1. seed: 두 저장소 empty 확인→합성 session/pending receipt write→barrier/readback.
2. force-stop/PID 소실 후 새 process check-pending: 원래 account/request/token/expiry 일치.
3. 새 process confirm: tokenless confirmed 저장, session 삭제→각 barrier/readback.
4. 새 process check-confirmed: confirmed raw token 없음/session 없음.
5. 새 process clear: receipt 삭제→barrier/readback.
6. 새 process check-clear: 양쪽 null.

각 단계 후 force-stop한다. 중간 reinstall/clear-data는 없다. 90초 미응답/한 번의 FAIL이면 중단하며 자동 재시도하지 않는다. verdict와 합성 앱 PID만 출력한다. 종료 정리는 이 package의 force-stop뿐이며 기록 삭제/기기 wipe는 없다.

## 범위

실제 빌드의 최소 API(`flutter.minSdkVersion` resolved 값 확인)와 최신 설치가능 API 각각 새 AVD에서 검증해야 한다. 하나의 API PASS를 초기 Android부터 최신까지의 보장으로 확대하지 않는다. API/ABI/Flutter·plugin·native SHA/APK hash/시각/단계별 verdict를 기록한다. 설치·약관·컴파일 제약은 미실행으로 표시한다. mock failure 테스트와 실제 OS 확인을 분리하며 전원차단/reboot/backup 복원/물리기기별 동작은 이 force-stop 시험으로 보장하지 않는다.

## 실제 실행 기록: API 36 ARM64 (2026-11-19 UTC)

독립 검토한 target 커밋 `6442b21`을 위 준비 스크립트로 archive한 전용 복사본에서 빌드했다. `assembleDebug` 20.5초, exit0. Flutter3.50.0 / Dart3.14.0, flutter_secure_storage11.2.0, native barrier 기반 `590e71b`. APK SHA256: `ca98aa2eb8ea2df561d29cd05ce4cc21eff7185c0326e78f89e7f65843ba04d3`. aapt로 package `.receiptprobe`, debuggable, minSdk24/targetSdk36 확인.

전용 새 AOSP AVD `nolleoon_receipt_probe_api36`, 명시 serial `emulator-5580`, API36/arm64-v8a에서 실제 실행했다. 해당 test package 미설치 확인 뒤 한 번 설치했고 중간 reinstall/clear-data는 없었다. production main/실계정/운영 API를 실행하지 않았다. 같은 emulator의 별도 표준 앱 package는 수정하거나 저장소를 읽지 않았다.

| 단계 | 결과 | 실제 process PID |
|---|---|---:|
| seed | PASS | 2495 |
| check-pending | PASS | 2556 |
| confirm | PASS | 2613 |
| check-confirmed | PASS | 2669 |
| clear | PASS | 2727 |
| check-clear | PASS | 2785 |

각 PASS 뒤 `am force-stop` 및 PID 없음 확인을 거쳤다. pending은 원래 합성 account/request/token/digest/expiry와 일치했고 confirmed는 동일 digest·expiry를 유지하면서 raw token이 없었다. session 삭제와 receipt 삭제 모두 다음 process에서도 확인했다. 마지막 03:13:41Z 확인에서도 probe PID 없음. 저장소를 mock하지 않고 실제 plugin/Android barrier 경로로 수행했다.

이는 **API36 emulator 한 환경의 강제 종료/재시작 검증**이다. minSdk24는 APK 선언일 뿐 API24 실제 실행이나 Android24–36 전체 보장이 아니다. API24/다른 API/실제 기기/전원 차단/reboot/backup 복원/손상 디스크의 동작은 미실행이며 별도 gate로 남는다. channel 누락/오류/timeout의 합성 단위 시험도 실제 OS 장애 시험과 구분한다.

## 추가 실제 실행: 최소 API 24 ARM64 (2026-11-19 UTC)

승인된 공식 AOSP API24 ARM64 이미지의 새 전용 AVD `nolleoon_receipt_probe_api24`가 부팅되어, 명시 serial `emulator-5582`에서 같은 `ca98aa2e…ba04d3` APK와 동일 driver를 실행했다. 새 build는 없고 API36 AVD/기존 표준 앱은 변경하지 않았다. QEMU/AVD명/미설치/package/debuggable guard를 그대로 통과한 뒤 한 번만 설치했다.

| 단계 | 결과 | 실제 process PID |
|---|---|---:|
| seed | PASS | 2487 |
| check-pending | PASS | 2554 |
| confirm | PASS | 2620 |
| check-confirmed | PASS | 2688 |
| clear | PASS | 2754 |
| check-clear | PASS | 2820 |

각 단계 뒤 force-stop/PID 소실, 다음 단계 새 PID를 확인했고 중간 reinstall/clear-data는 없었다. 최종 03:18:09Z에도 probe process 없음. 실제 SDK API24/ABI arm64-v8a에서 원래 합성 receipt/digest/expiry 보존, confirmed tokenless/session 삭제, receipt 삭제 뒤 null을 모두 확인했다.

앞 절의 **API24 미실행 상태는 이 추가 실행으로 해소**됐다. 현재 실측은 API24와API36 AOSP emulator 두 끝점이며, 중간 모든 API·제조사별 물리기기·전원 차단·reboot·backup 복원 검증으로 확대하지 않는다. 앱의 실제 게임/실계정/Kakao 인증 전체 흐름은 이 합성 저장소 probe의 범위가 아니다.
