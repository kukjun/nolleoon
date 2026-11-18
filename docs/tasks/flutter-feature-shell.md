# Flutter feature shell

## 목표와 경계

검증된 계정 하위에서 기존 방·프로필·관리·초대·게임·기록·탈퇴 모듈을 실제 native API 저장소에 연결한다. 서버 규칙, 배포, 계정 등록, 운영 자료 및 OS 권한 설정은 변경하지 않는다.

## 수명과 합격 기준

- 계정별 root owner는 불확실한 명령의 원래 requestId/body와 라우팅 ID만 보존한다. background에는 모든 개인 화면/controller를 폐기하며, 같은 계정을 재검증한 뒤 사용자가 명시적으로 재시도한다.
- 다른 계정/로그아웃은 회복 상태를 폐기한다. room별 관리 명령은 서로 섞이지 않는다.
- 계정 탈퇴 영수증은 별도의 원래 인증을 보존한다. 서버 성공 뒤에는 로컬 정리만 재시도하며 원격 logout/unlink를 호출하지 않는다. 강제 종료 뒤 영수증 복원은 별도 미완료 항목이다.
- 보호된 nested navigator에만 게임 설정과 개인 기능을 둔다. 인증 확인/실패 중에는 기존 개인 화면이 보이지 않는다.
- 등록된 게임만 설정·실행할 수 있으며 서버 결과를 표시한다. 로컬에서 결과를 만들지 않는다.
- 320/390px, 큰 글씨, back/cancel, keyboard, 반복 요청, background/auth/error 조합을 합성 widget 환경에서 검증한다. 실제 OS/기기 검증과 구분한다.

## 검증 현황

- 새 FeatureSession 미구현 RED 확인 후 root 모델 구현.
- auth local-only 정리: 기존 포함 focused 10 PASS (108815d), 독립 리뷰 대기.
- root profile/room/game selection/management/history 이동 및 background 보호: 320/390 각 PASS.
- 명시적 탈퇴 확인→합성 서버 성공 1회→로컬 정리→로그인 화면: PASS, 원격 logout 0.
- 전체 앱 회귀, 네 게임 실제 조합 및 독립 리뷰: 진행 중. 현재 단위 결과를 실서버/기기 완료로 해석하지 않는다.

## Known limits

사진 선택 adapter는 native 구성 검증 전 기본 비활성이다. 현재 원본 1MiB/4MP 제한으로 일반 고해상도 사진은 거절될 수 있다. OS/plugin downscale 검토는 별도 범위다. 실제 사용자 사진을 테스트에 사용하지 않는다.

### 1차 합성 체크포인트

- 전체 `flutter test`: 197 PASS (trial 모듈 합성 전). `flutter analyze`: clean.
- root 제비 공개/메뉴 패스 실제 feature dispatch 및 서버 projection 표시: 2 PASS.
- background 도중 미확정 제비 공개 → 같은 계정 복귀 → 자동 재전송 없음 → 명시적 동일 body/requestId retry: PASS. 늦은 이전 응답도 추가 요청/개인 화면 복원 없음.
- root 390px 테스트에 textScale 1.6 적용, overflow/렌더링 예외 없음. 테스트는 Flutter 합성 renderer/transport이며 실기기나 실제 인증 성공을 의미하지 않는다.
- 단순 실행 경로 오타(없는 test 파일) 및 fixture pump/scroll 조정 과정의 실패는 수정 후 올바른 `test/app` 16 PASS, 위 전체 197 PASS로 재확인했다.

### 공개 프리셋과 완료 판 복귀

- 방 멤버 및 팀/제비 결과는 승인된 RoomDto의 presetId로 기존 10개 public asset을 표시한다. 알 수 없는/나간 멤버는 중립 fallback이며 개인 이미지 URL·인증 계약은 확대하지 않는다. 익명 투표 이유에는 아바타를 붙이지 않는다.
- GameController가 응답 뒤 room cache를 지우는 경우에도 root의 해당 승인 방 snapshot을 이름/프리셋 fallback으로 사용한다. 보호된 subtree가 사라질 때 이 snapshot도 함께 폐기된다.
- 완료된 판은 activeRun에 남지 않으므로 onRunAvailable로 식별자만 root owner에 저장하고, background 복귀 때 같은 판을 서버에 재조회한다. 저장된 projection을 그대로 복원하지 않는다.
- focused root 8 PASS: 원래 320/390/큰 글씨 흐름, 팀 결과의 이름·preset 매핑, 완료 판 background 복귀 재조회, 제비/메뉴 action, 미확정 동일 명령 retry, 탈퇴 확인 포함.

### 4게임 registry

재판 모듈을 추가해 팀/제비/메뉴/재판의 실제 feature를 모두 연결했다. 재판 제한 projection은 별도 최소 진행 제어 callback으로만 처리하며 일반 play에 전달하지 않는다. 준비 수정은 허가된 DTO에서 사건·벌칙·피고·제한시간 네 설정만 allowlist 변환하고 원래 참가자 명단/version을 공통 controller가 보존한다. root 재판 투표 화면→명시적 기권 제출의 실제 command 연결 focused PASS. 사건/벌칙은 접힌 안내를 열어 확인하며 타인의 미공개 투표는 렌더링하지 않는다.

### 영속 영수증 bootstrap

- 실제 앱은 SecureDeletionReceiptStore를 기본 주입한다. 테스트만 명시적인 합성 store를 주입한다. read 완료 전에 일반 로그인·probe·초대 preview를 시작하지 않는다.
- pending 복원은 원래 계정/requestId/token/절대만료를 그대로 사용하고 명시 retry 전에는 POST하지 않는다. confirmed 복원은 token 없이 digest 검증한 로컬 cleanup만 수행한다.
- 성공 UI 전에 인증·SDK 메모리·영수증 정리를 모두 await한다. 정리 실패는 성공으로 표시하지 않는다. 새로 저장된 다른 credential의 digest가 다르면 지우지 않는다.
- 아직 제출하지 않은 탈퇴 확인은 pending 예외가 아니다. background 뒤 같은 계정의 fresh 검증이 끝나기 전에는 확인/제출 UI를 숨긴다(리뷰 P2 수정).
- bootstrap 5 focused PASS: pending/confirmed 명시 retry, malformed 차단, 다른 credential 보존, 신규 탈퇴 재검증 gate.
- 손상/만료 기록을 자동 삭제하지 않는다. 명시적인 로컬 복구 UX는 별도 후속 변경으로 구현한다.
- APK/IPA·플랫폼 키·동일 Kakao 앱 등록·URL scheme·서명·AASA/assetlinks·실기기 확인 전 native gates는 false를 유지한다.

### 손상/만료 영수증의 명시적 기기 복구

안전 차단 뒤 두 단계로 이 기기의 로그인과 임시 복구 기록만 정리할 수 있다. 다른 저장 계정도 이 기기에서 로그아웃되며, 서버 탈퇴 성공을 확인한 것이 아니고 서버 계정·게임 기록을 삭제하지 않는다고 고지한다. 원격 probe/logout/unlink 호출은 없다. 인증 저장소·SDK 메모리·영수증 clear 중 하나라도 실패하면 로그인 gate를 열지 않으며 로컬 재시도만 제공한다. focused 6 bootstrap + 기본320/큰글씨2 = 8 PASS, cancel 전후 기존 token 보존/부분실패 차단 포함.

### 기존 sidecar 개인 이미지 연결

기존 native room avatars API를 새 서버 계약 없이 소비한다. 계정별 stable repository와 방별 RoomAvatarsScope를 로비·게임 화면에 연결했다. 결과는 RoomMemberAvatar의 public preset 또는 인증된 private bytes를 표시하며, 해당 방이 닫히거나 계정/화면/background 경계가 바뀌면 private 버퍼와 decoded image를 폐기한다. 프로필에서 돌아오면 새 scope가 현재 revision을 다시 읽는다. restricted/redacted 투표/이유에는 참가자 아바타를 붙이지 않는다.

합성 owned WebP를 이용한 root 로비 sidecar→Bearer 전용 binary 요청→개인 이미지 표시→background 제거 focused PASS. 실제 사용자 사진·OS picker는 사용하지 않았다. 기존 root4화면 회귀도 PASS.

## 최종 합성 검증

- 4게임·프로필·방/휴지통 관리·초대·기록·탈퇴 root 연결, sidecar 이미지, 영수증 v2/직렬 저장, 초안 dialog 소유권 수정까지 합성한 `9b84c44` 기준 전체 Flutter **251 PASS**.
- analyze에서 import/중괄호 info 4개를 확인해 규칙을 약화하지 않고 소스 표현만 정리한 뒤 **No issues found**.
- 실서버 native 로그인/OS permission·키체인/사진선택·딥링크·서명·APK/IPA 빌드는 수행하지 않았다. 모든 결과는 합성 transport 또는 기존 unit/widget 환경이며 운영 배포는 없다.
- independent review의 후속 발견이 있으면 같은 기준으로 수정/재검증한다.

### 사진 source 배선 누락 후속

`main → AuthGate → FeatureSession → FeatureShell → ProfileScreen`에 `configuredNativePhotoSource`를 연결했다. 별도 `NATIVE_PHOTO_PLATFORM_VERIFIED`의 기본값은 false이며 실제 권한·플랫폼 설정 및 기기 검증 전 활성화하지 않는다. 테스트는 명시적 fake source만 주입한다.

OS picker가 별도 Activity로 이동할 수 있으므로 root의 계정별 PhotoSelectionOwner가 미완료 선택만 메모리에서 전달한다. 결과는 1MiB 이하의 허용 이미지 입력만 보관하며 같은 계정을 새로 확인한 ProfileScreen에서 한 번 소비한다. 저장·자동 업로드 권한은 없고, 취소/로그아웃/다른 계정/루트 폐기 때 버퍼를 지운다. 기존 picker가 완료되기 전 중복 OS 선택 호출도 하지 않는다. 미리보기를 이미 소비한 뒤의 background에는 기존 private 화면/사진을 폐기한다.

집중 검증: profile 및 root photo **28 PASS**. 실제 codec으로 합성 소유 WebP 선택→미리보기→명시 저장 전 upload 0→저장 후 Bearer 업로드 1, 서버 오류 시 성공 표시 없음, 취소, inactive→보류된 재인증 중 선택 완료→화면 없음→같은 계정 확인 후 새 화면 미리보기→명시 저장, 다른 계정의 늦은 입력 제거를 확인했다. Flutter 가상 비동기 영역에서 이미지 codec을 기다리지 못한 초기 fixture 실패는 실제 `runAsync` 영역의 프레임 처리로 고쳤으며 제품 판정 조건은 유지했다. 실제 Android/iOS picker 성공은 아직 별도 게이트다.
