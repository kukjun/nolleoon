# 외부 HTTPS 인수 준비: 실행 blocked

## 현재 확인된 사실

실제 외부 도메인 배포와 DNS/터널/지속 프로세스 변경은 승인·적용되지 않았다(#65). 따라서 이번 MVP-30 작업은 준비만 수행한다. 추정 hostname을 방문하거나 운영 방을 생성하지 않았고, 실제 네트워크 probe도 실행하지 않았다. 외부 게임/TLS/cookie/기존 서비스 무영향을 검증했다고 주장하지 않는다. #29·#30은 OPEN이며 #28 실기기 검증도 별도로 blocked다.

로컬 production 빌드·localhost·Chromium 자동화·합성 DB 성공은 외부 네트워크 성공과 다르다. 같은 Mac의 loopback이나 LAN에서 여는 것은 외부 접속 근거가 아니다. 중국 현지 조건은 요구 범위 밖이다.

## 먼저 필요한 입력

- 승인된 정확한 HTTPS origin과 추가 route diff, 해당 변경·프로세스 시작 승인
- 배포할 release commit과 실제 실행 release의 독립 확인 근거
- 같은 맥미니 LAN 밖의 네트워크/시험 실행 위치 및 날짜
- 실제 5개 독립 브라우저 신원으로 synthetic 게임을 생성할 실행 승인과 시점
- 기존 서비스의 비교 기준과 확인할 대상. 문제 발생 시 새 서비스만 복구할 승인 범위
- 실제 기기 항목을 수행할 경우 #63에서 확보한 기기/OS/브라우저와 필요한 접근

현재 local HEAD를 deployed commit으로 자동 기록하지 않는다. remote branch와 build artifact가 같은지 확인해도 실제 프로세스가 그 release를 사용한다는 근거는 별도로 필요하다. 코드 변경 후에는 앞선 RC의 성공을 새 release에 재사용하지 않는다.

## 승인 후 실제 실행 순서

1. 승인된 route·새 프로세스·전용 DB 경로를 적용한 담당자가 실제 설정과 실행 release 근거를 남긴다. 기존 route와 원본 서비스는 그대로 둔다. 현재 준비 작업은 이 단계를 실행하지 않았다.
2. 외부 네트워크에서 인증서/hostname/HTTPS를 확인한다. 경고를 임의 우회하지 않는다. redirect가 생기면 새 목적지와 권한 범위를 확인하고, 다른 origin으로 cookie나 명령을 재전송하지 않는다.
3. health 응답과 HTML/JS/CSS 렌더를 각각 확인한다. unknown API가 index.html 200으로 숨겨지지 않는지, 원본 포트·DB·환경 파일이 공개되지 않는지 확인한다. 이 GET 결과만으로 다음 단계에 PASS를 주지 않는다.
4. 실제 외부 브라우저에서 Secure/HttpOnly/SameSite cookie와 같은 origin API를 확인한다. cookie 원문·토큰은 evidence에 저장하지 않는다. HTTP 200만이 아니라 로그인 없는 신원 생성과 재방문 동작을 확인한다.
5. 5개 독립 신원으로 방 생성→초대 참여→설정/역할/벌칙 동의→변론→방장의 동시 투표 시작→각자 제출→동기화된 익명 결과를 실제 UI에서 수행한다. 단일 브라우저 역할 토글이나 mock snapshot으로 대체하지 않는다.
6. 한 신원을 실제 네트워크에서 끊고 복귀/새로고침한다. 이미 접수된 표와 동일 마감, 중복표 없음, 서버 기준 마감 실패 안내를 확인한다. 마감 시간을 클라이언트 시간으로 연장하지 않는다.
7. 개인 기록과 비참가 신원의 접근 거부를 확인한다. 결과의 과거 case/penalty를 신규 참가자에게 노출하지 않는다. 세부 수락 기준은 기존 E2E와 동일하지만 실제 배포 RC/외부 경로에서 새로 증거를 남긴다.
8. 기존 서비스의 승인된 비교 대상이 여전히 동작하는지 확인한다. 기존 장애가 이미 있었다면 새 배포가 원인이라고 단정하지 않고 전후 관측을 구분한다.
9. 실패 시 시험을 멈추고 증상을 기록한다. 자동으로 DNS/보안 설정을 완화하거나 기존 서비스를 재시작하지 않는다. 승인된 새 서비스 범위에서만 [복구 계획](deployment-preparation.md)을 따른다. DB 복구는 새 파일로 검증하고 손실 범위를 확인한다.

위 항목은 현재 전부 **미실행/blocked**다. 실제 실행 전후 승인·소스·환경·결과가 채워져야 한다.

## 관측과 주장 분리

[빈 evidence 템플릿](../deploy/templates/external-evidence.example.json)은 target/commit을 null, observations를 빈 배열로 둔다. 운영자의 “배포 완료” 설명은 `operatorClaims`에 구분하며 실측 항목으로 계산하지 않는다.

각 observation에는 `kind`, 실제 ISO 시각 `observedAt`, `network: {kind: "external", source: "실제 확인한 외부 실행 위치/종류"}`, 증거 식별자 `evidence`, 관측 결과 `result`를 기록한다. 개인 IP·기기 serial·쿠키·게임의 실제 개인정보를 담지 말고 합성 데이터만 사용한다. 파일/영상/trace에 비밀값이 있으면 공유 전에 제거한다. `sourceEvidence`는 실제 배포 release 확인 기록이며 local HEAD만으로 채우지 않는다.

필수 kind: `tls`, `health`, `static`, `cookie`, `invite`, `five-player-vote`, `sync`, `reconnect`, `history`, `existing-service`. 이 구조는 기록의 누락을 찾는 형식이지 사실 인증이나 권한 부여 장치가 아니다.

## 오프라인 누락 검사

```sh
node tools/deployment/external-evidence.mjs deploy/templates/external-evidence.example.json
```

이 도구는 명시된 JSON 파일만 읽고 네트워크 요청/DNS 조회/브라우저 실행을 하지 않는다. 빈 템플릿은 blocked다. 공개 HTTPS hostname 형식, 동일한 expected/observed commit, 외부 provenance와 각 관측 항목이 모두 있어도 최대 결과는 `ready-for-independent-review`다. 절대 외부 인수 PASS를 반환하지 않는다. 파일·링크의 실재 여부, DNS의 실제 주소, 관측의 진위·최신성, 배포된 process를 도구가 확인하지는 않는다. 기록을 작성한 사람이 사실로 확인하고 독립 리뷰가 검증해야 한다.

자동 단위 시험의 완전한 synthetic observation은 이 누락 검사의 false-pass 방지 근거일 뿐 외부 실행 근거가 아니다. 일반 `npm run check`에도 실제 외부 네트워크 작업을 넣지 않는다. 하네스 planned `external-deployment`는 #65 차단을 그대로 표시한다.

## 이번 준비 검증

검사기 모듈 부재 RED 후 synthetic 자료 시험을 구현했다. 실제 빈 템플릿의 target 미확정 상태를 `incomplete`가 아니라 `blocked`로 보고하도록 추가 RED→GREEN을 확인했다. 로컬/사설 IP·예시/예약 hostname·비 HTTPS/인증 URL·경로·query, 주장만 있는 자료, commit 불일치, 외부 provenance/5인 관측 누락을 검사한다. 완비된 synthetic 자료도 `verified: false`이며 독립검토 준비 상태에 그친다. 실제 CLI 누락 파일/빈 템플릿의 종료 코드 1과 값이 제거된 출력도 확인한다. 이 검증은 실제 도메인의 실패나 성공을 재현한 것이 아니다.
