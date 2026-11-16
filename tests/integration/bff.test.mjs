import test from 'node:test';
import assert from 'node:assert/strict';
import { apiFixture } from '../support/api-fixture.mjs';
test('실제 BFF는 고정 오류 계약과 no-store만 반환하며 원본 입력을 반사하지 않는다',async()=>{
 const f=await apiFixture();try {
  const missing=await fetch(`${f.url}/api/session`);assert.equal(missing.status,401);assert.equal((await missing.json()).error.code,'SESSION_REQUIRED');
  const csrf=await fetch(`${f.url}/api/session`,{method:'POST',headers:{origin:'https://attacker.example','content-type':'application/json'},body:'{"token":"private-secret"}'});
  assert.equal(csrf.status,403);assert.deepEqual(await csrf.json(),{error:{code:'FORBIDDEN',message:'이 요청을 수행할 권한이 없습니다.'}});assert.equal(csrf.headers.get('cache-control'),'no-store');
  const invalid=await fetch(`${f.url}/api/session`,{method:'POST',headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1'},body:'{"participantId":"private-secret"}'});
  assert.equal(invalid.status,400);assert.equal((await invalid.json()).error.code,'INVALID_INPUT');
  const malformed=await fetch(`${f.url}/api/session`,{method:'POST',headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1'},body:'{private-secret'});
  assert.equal(malformed.status,400);assert.equal((await malformed.json()).error.code,'INVALID_INPUT');
  const unknown=await fetch(`${f.url}/api/not-implemented?secret=private-secret`);assert.equal(unknown.status,404);const body=await unknown.json();assert.equal(body.error.code,'NOT_FOUND');assert.ok(!JSON.stringify(body).includes('private-secret'));
 }finally{await f.close();}
});
