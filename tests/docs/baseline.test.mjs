import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const read = p => readFileSync(resolve(root, p), 'utf8');
const active = () => readdirSync(resolve(root, 'docs/design')).filter(n => n.endsWith('.md')).map(n => read(`docs/design/${n}`)).join('\n') + read('docs/product.md');
test('active baseline has no superseded implementation directives', () => {
  assert.doesNotMatch(active(), /MVP 이양 없음|MVP 방장 이양 없음|MVP는 방장 이양 대신|방장 이양 대신 새 사건|FastAPI|PostgreSQL|중국 본토.*검증 전 미확인/);
});
test('single current policy specifies transfer, roles, tie reasons and deployment boundary', () => {
 const rules = read('docs/design/00-current-rules.md');
 for (const text of ['방장도 피고', '10분', '접속 중', '무작위', '1차 집계·익명 이유', '최후 변론', 'Cloudflare Tunnel', 'SQLite', 'NestJS']) assert.ok(rules.includes(text), text);
});
test('requirement and test IDs remain traceable, obsolete gates retired', () => {
 const req = read('docs/design/04-requirements.md');
 for(let i=1;i<=70;i++) assert.match(req,new RegExp(`\\| REQ-${String(i).padStart(3,'0')} \\|`));
 assert.match(req,/\| REQ-032 \| 폐기/);
 const verification = read('docs/design/09-verification.md');
 for(let i=1;i<=65;i++) assert.match(verification,new RegExp(`\\| T-${String(i).padStart(2,'0')} \\|`));
 assert.match(verification,/\| T-22 \| 폐기/);
 assert.match(verification,/\| T-26 \| MVP 제외/);
});
test('technical decisions and unverified product status explicit', () => {
 const adr=read('docs/decisions/0002-mvp-architecture.md');
 for(const text of ['통합 BFF', 'SQLite', '마이그레이션', '세션', '폴링', '미검증', '버전']) assert.ok(adr.includes(text), text);
 assert.match(read('docs/design/02-open-questions.md'), /피고.*중단/);
 assert.match(read('docs/design/09-verification.md'), /제품 시험.*미실행/);
});
test('active local document links resolve', () => {
 const paths = readdirSync(resolve(root, 'docs/design')).filter(n => n.endsWith('.md')).map(n => `docs/design/${n}`);
 paths.push('docs/product.md', 'docs/decisions/README.md', 'docs/decisions/0002-mvp-architecture.md');
 for (const p of paths) for (const match of read(p).matchAll(/\]\(([^)]+)\)/g)) {
  const link = match[1]; if (/^https?:|^#/.test(link)) continue;
  assert.doesNotThrow(() => readFileSync(resolve(root, p, '..', link.split('#')[0])), `${p}: ${link}`);
 }
});
test('active references do not depend on removed screen or NFR IDs', () => {
 assert.doesNotMatch(active(), /\b(?:NFR|M)-\d+/);
 assert.doesNotMatch(read('docs/design/04-requirements.md'), /무응답 시 방장이 없이|무응답도 없이/);
});
