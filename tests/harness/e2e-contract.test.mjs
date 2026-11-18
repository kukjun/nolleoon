import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import config from '../../playwright.config.mjs';
import {LEGACY_BROWSER_CHECKS} from '../../tools/harness/legacy-browser.mjs';
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
 assert.match(checks,/\.\.\.LEGACY_BROWSER_CHECKS/);
 for(const features of LEGACY_BROWSER_CHECKS){assert.equal(features.args[2],'--grep-invert');assert.equal(features.args[3],'@e2e|@mobile');assert.equal(features.timeoutMs,360000);}
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

test('새 파티 파일은 별도 실제 gate로 빠짐·중복 없이 분리한다',async()=>{
 const party=(await import('../../playwright.party.config.mjs')).default;
 assert.deepEqual(config.testIgnore,['**/travel-*.spec.mjs','**/party-*.spec.mjs','**/avatar-picker.spec.mjs']);
 assert.deepEqual(party.testMatch,['**/party-*.spec.mjs','**/avatar-picker.spec.mjs']);assert.deepEqual(party.testIgnore,[]);
 assert.equal(party.retries,0);assert.equal(party.timeout,20000);
 for(const id of ['party-browser','party-e2e']){const gate=checks.split('\n').find(line=>line.includes(`id:'${id}'`));assert.match(gate,/kind:'playwright'/);assert.match(gate,/--config=playwright.party.config.mjs/);assert.match(gate,/timeoutMs:180000/);}
 assert.match(checks.split('\n').find(line=>line.includes("id:'party-browser'")),/'--grep-invert','@party-e2e'/);
 assert.match(checks.split('\n').find(line=>line.includes("id:'party-e2e'")),/'--grep','@party-e2e'/);
 assert.match(scripts['test:party'],/--grep-invert @party-e2e/);assert.match(scripts['test:party-e2e'],/--grep @party-e2e/);
});

test('여행방 UI와 실제API E2E는 별도 gate로 빠짐·중복 없이 실행한다',async()=>{
 const travel=(await import('../../playwright.travel.config.mjs')).default;
 assert.equal(travel.testMatch,'travel-*.spec.mjs');assert.equal(travel.retries,0);
 for(const id of ['travel-browser','travel-e2e']){const gate=checks.split('\n').find(line=>line.includes(`id:'${id}'`));assert.match(gate,/kind:'playwright'/);assert.match(gate,/--config=playwright.travel.config.mjs/);}
 assert.match(scripts['test:travel'],/--grep-invert @travel-e2e/);assert.match(scripts['test:travel-e2e'],/--grep @travel-e2e/);
});
