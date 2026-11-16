import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const read = name => readFileSync(new URL(`../../deploy/templates/${name}`, import.meta.url), 'utf8');
test('운영 환경 예시는 격리된 loopback과 비공개 DB를 사용한다', () => {
 const env = Object.fromEntries(read('production.env.example').split('\n').filter(line => line && !line.startsWith('#')).map(line => line.split('=')));
 assert.deepEqual(env, {NODE_ENV:'production',API_HOST:'127.0.0.1',API_PORT:'3101',WEB_ROOT:'/absolute/private/releases/current/apps/web/dist',DB_PATH:'/absolute/private/data/trip-court.sqlite',PUBLIC_ORIGIN:'https://tripcourt.example.com'});
 assert.equal(env.DB_PATH.startsWith(env.WEB_ROOT), false);
});
test('launchd 예시는 자동 적용·자동 시작 없이 명시적 검토를 요구한다', () => {
 const plist = read('local.trip-court.example.plist');
 assert.match(plist, /<key>Label<\/key>\s*<string>local\.trip-court\.example<\/string>/);
 assert.match(plist, /<key>RunAtLoad<\/key>\s*<false\/>/);
 assert.match(plist, /<key>KeepAlive<\/key>\s*<false\/>/);
 for(const path of ['/absolute/path/to/node','/absolute/private/releases/current/apps/api/dist/main.js','/absolute/private/logs/trip-court.stdout.log','/absolute/private/logs/trip-court.stderr.log'])assert.ok(plist.includes(path));
 assert.match(plist, /<key>WorkingDirectory<\/key>\s*<string>\/absolute\/private\/releases\/current<\/string>/);
 assert.match(plist, /<key>API_PORT<\/key>\s*<string>3101<\/string>/);
 assert.match(plist, /<key>API_HOST<\/key>\s*<string>127\.0\.0\.1<\/string>/);
});
test('Cloudflare 조각은 기존 catch-all과 서비스 설정을 교체하지 않는다', () => {
 const ingress = read('cloudflared-ingress.example.yml');
 const active = ingress.split('\n').filter(line=>line.trim()&&!line.trim().startsWith('#')).join('\n');
 assert.equal(active, '- hostname: tripcourt.example.com\n  service: http://127.0.0.1:3101');
 assert.match(ingress, /catch-all/);
});
test('공개 템플릿에는 실제 사용자 경로·인증값·설치 실행 도구가 없다', () => {
 const names=readdirSync(new URL('../../deploy/templates/',import.meta.url));
 assert.deepEqual(names.sort(), ['cloudflared-ingress.example.yml','local.trip-court.example.plist','production.env.example']);
 for(const name of names){
  const content=read(name);
  assert.doesNotMatch(content, /\/Users\/|\/home\/|0\.0\.0\.0|\[::\]|localhost:3000|127\.0\.0\.1:3000|launchctl|sudo|credentials-file:|tunnel:|TUNNEL_TOKEN=/);
 }
});
