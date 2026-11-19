# #210 Android process-death probe

**준비 코드이며 실제 Android 실행 성공 기록이 아니다.** Kotlin 컴파일/OS 저장/강제종료 결과는 별도다.

## 격리와 실행

새 전용 AVD `nolleoon_receipt_probe_api<API번호>`만 사용한다. 기존 emulator/물리기기/사용자 설치는 금지한다. `tools/mobile/prepare-receipt-probe.sh`는 현재 커밋을 새 임시폴더에 archive하여 그 복사본 debug에만 `.receiptprobe` applicationIdSuffix를 넣는다. 원본 Gradle/main은 수정하지 않는다.

그 복사본의 apps/mobile에서 `flutter build apk --debug --target test_targets/receipt_process_probe.dart`로만 빌드한다. package는 `com.example.nolleoon_mobile.receiptprobe`. production main을 target으로 빌드한 APK를 전달하면 안 된다. release pipeline은 이 target을 참조하지 않는다.

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
