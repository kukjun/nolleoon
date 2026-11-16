# CI 초안 · 인증 차단

`harness.yml`은 **실행되지 않는 초안**이다. 원래 workflow 경로의 게시가 GitHub OAuth `workflow` 범위 부재로 거부되어 이곳에 보존했다. 권한을 확대하거나 우회하지 않았다. [#36](https://github.com/kukjun/trip-court/issues/36)이 해결되어 승인된 인증으로 `.github/workflows/harness.yml`에 게시하고 실제 결과를 확인하기 전까지 원격 CI는 미실행/차단이다.

로컬 `npm run check` 결과와 독립 리뷰는 별도 증거다. 이 파일 존재나 로컬 통과를 원격 CI 통과로 보고하지 않는다. 비밀·추가 서비스·브랜치 보호 설정을 요구하는 초안이 아니다.
