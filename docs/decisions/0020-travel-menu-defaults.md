# 메뉴 정하기 최소 규칙 (#135/#136)

상태: 사용자 일반 구현 위임 아래 조정자가 채택한 비파괴 기본값. 사용자가 각 세부 규칙을 직접 확정했다는 뜻이 아니다. 최종 독립 내용/코드 리뷰 전 #135 완료를 주장하지 않는다.

## 규칙
- 여행방의 선택된 참가자 최소 2명을 시작 시 고정. 벌칙 없음.
- 각자 후보 1개 또는 명시적인 패스. NFC, 앞뒤/연속 공백, Latin 대소문자 정규화 후 1–80 Unicode code points. 별칭/의미 동의어는 합치지 않음. 정규화된 메뉴 자체를 표시하여 첫 제출자의 표기 순서를 노출하지 않는다.
- 다른 사람 후보/제출 순서는 수집 중 비공개. 본인 제출만 확인한다. 제출은 불변이며 같은 canonical 값 재시도만 멱등이다.
- 전원 응답 시 가장 많이 나온 후보를 선택. 최다 후보가 동률이면 정렬된 최다 후보 집합에서 서버 난수 공급자가 균등 인덱스 한 번을 선택한다. 한 종류만 있으면 난수 없이 선택. 전원 패스는 no-choice.
- 상태와 결과를 같은 transaction에 저장해야 한다. 결과 재조회/재시작/재시도로 다시 추첨하지 않는다. 엔진은 순수 전이이고 저장/요청 영수증/권한 검증은 여행방 application service 책임이다.
- 진행자만 명시적 ‘결정 없이 취소’ 명령으로 incomplete 종료할 수 있다. UI는 확인을 받아야 한다. 취소는 후보를 공개하지 않고 완료 결과를 바꿀 수 없다. 자동 타임아웃/미응답 자동기권/강제 결정 없음.
- 완료 후 현재 방 멤버에게 최종 선택 메뉴 또는 no-choice만 제공한다. 후보 목록, 빈도, 작성자 매핑은 공개하지 않는다. 현재 방 소속 검사는 projector 호출 전 필요하다.
- 새로운 판은 새 ID. 진행자 교체는 후보/참가자 동결을 변경하지 않는다. 진행자 적격자 0명은 vacancy 정책 gate이며 이 엔진은 임의 진행자나 결과를 만들지 않는다.
- 건강/알레르기/종교 입력이나 자유 이유 필드 없음. 식사 안전을 보장하는 기능이 아니다.

## 계약
설정 `{}`. 명령 `{type:'submit',menu:string}`, `{type:'pass'}`, `{type:'cancel'}`. 외부 envelope의 runId/requestId/version은 공통 service가 처리한다. 타입/추가 필드는 엄격히 검사한다.

projection은 `{kind:'menu',phase,self:{eligible,submission},result}`. phase는 draft/collecting/completed/incomplete. 수집 중 본인 submission은 null 또는 `{kind:'candidate',menu}` / `{kind:'pass'}`. terminal에서는 본인 submission도 null. result는 null 또는 `{outcome:'selected',menu}` / `{outcome:'no-choice'}`. 취소된 판에서 candidate는 어디에도 공개하지 않는다.

## 검증 범위
순수 도메인 9개 + 어댑터 4개 시험: 초기 RED는 구현 모듈 부재로 각각 test file 1 fail. GREEN 13개. Unicode/빈값/악성문자/추가필드/대상위조/수정거부/난수경계/멱등/직렬화 재로딩/취소 및 공개 allowlist 검증. 실제 HTTP·SQLite 원자성/동시 제출·브라우저 UI는 공통 backend 통합 후 별도로 검증해야 한다. 이 문서는 해당 통합 테스트 통과나 전체 제품 완료를 주장하지 않는다.
