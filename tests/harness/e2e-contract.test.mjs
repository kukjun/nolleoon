import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import config from '../../playwright.config.mjs';
const read = file => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const source = read('tools/harness/check.mjs');
const checks = source.split('const checks=[')[1].split('];')[0];
const planned = source.split('const planned=[')[1].split('];')[0];
const scripts = JSON.parse(read('package.json')).scripts;

test('gameplay E2E는 실제 별도 집계 gate이며 미구성 목록이 아니다', () => {
 const e2e = checks.split('\n').find(line => line.includes("id:'gameplay-e2e'"));
 assert.ok(e2e, 'gameplay-e2e runnable gate missing');
 assert.match(e2e, /kind:'playwright'/);
 assert.match(e2e, /'--grep','@e2e'/);
 assert.match(e2e, /timeoutMs:150000/);
 assert.match(e2e, /dependsOn:'build'/);
 assert.doesNotMatch(planned, /gameplay-e2e/);
});
test('기능 회귀와 E2E CLI 선택은 배타적이며 기존 기능 예산을 유지한다', () => {
 const features = checks.split('\n').find(line => line.includes("id:'browser-launch'"));
 assert.match(features, /'--grep-invert','@e2e\|@mobile'/);
 assert.match(features, /timeoutMs:300000/);
 assert.equal(scripts['test:browser'], 'playwright test --reporter=json --grep-invert "@e2e|@mobile"');
 assert.equal(scripts['test:e2e'], 'playwright test --reporter=json --grep @e2e');
 assert.equal(scripts['test:mobile'], 'playwright test --reporter=json --grep @mobile');
 for (const title of ['일반 기능', '@e2e 5인 전체 흐름', '@mobile 모바일 에뮬레이션']) {
  const e2e = /@e2e/.test(title);
  const mobile = /@mobile/.test(title);
  const feature = !/@e2e|@mobile/.test(title);
  assert.equal(Number(e2e) + Number(mobile) + Number(feature), 1);
 }
});
test('재시도 없이 실패 trace와 screenshot을 보존하며 기존 assertion 시간을 완화하지 않는다', () => {
 assert.equal(config.retries, 0);
 assert.equal(config.timeout, 15000);
 assert.equal(config.use.trace, 'off');
 assert.match(read('tests/browser/gameplay-e2e.spec.mjs'), /test\.use\(\{\s*trace\s*:\s*['"]retain-on-failure['"]\s*\}\)/);
 assert.equal(config.use.screenshot, 'only-on-failure');
});

test('모바일 에뮬레이션은 실행 gate이며 실기기 검증을 대신하지 않는다', () => {
 const mobile = checks.split('\n').find(line => line.includes("id:'mobile-emulation'"));
 assert.ok(mobile, 'mobile-emulation runnable gate missing');
 assert.match(mobile, /kind:'playwright'/);
 assert.match(mobile, /'--grep','@mobile'/);
 assert.match(mobile, /timeoutMs:90000/);
 assert.match(mobile, /dependsOn:'build'/);
 assert.match(planned, /id:'mobile-device',status:'blocked'/);
 assert.doesNotMatch(planned, /mobile-emulation/);
});

test('외부 배포는 승인 차단이며 로컬 E2E로 통과 처리하지 않는다', () => {
 assert.match(planned, /id:'external-deployment',status:'blocked'/);
 assert.doesNotMatch(checks, /kind:'(?:external|network)'/);
});
