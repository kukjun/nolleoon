import test from 'node:test';
import assert from 'node:assert/strict';
import { presentError } from '../../apps/api/dist/presentation/errors.js';
import { DomainFailure } from '../../apps/api/dist/domain/failure.js';
import { StorageError } from '../../apps/api/dist/application/ports/storage.js';
import { requestSession } from '../../apps/web/src/api/session-client.ts';
test('오류 프레젠터는 내부 예외·비밀·SQL을 복사하지 않는다',()=>{
 for(const error of [new Error('private-secret SQL'),new StorageError('storage','private-secret'),new DomainFailure('FORBIDDEN')]) {
  const dto=presentError(error);assert.deepEqual(Object.keys(dto.body),['error']);assert.deepEqual(Object.keys(dto.body.error),['code','message']);assert.ok(!JSON.stringify(dto).includes('private-secret'));
 }
 assert.equal(presentError(new StorageError('busy','private-lock')).status,503);
 assert.equal(presentError(new DomainFailure('DEADLINE_PASSED')).body.error.code,'DEADLINE_PASSED');
});
test('web 클라이언트는 공유 세션 계약을 검증하고 비정상/네트워크 오류를 안전하게 처리한다',async()=>{
 const fake=(ok,payload)=>async()=>({ok,json:async()=>payload});
 assert.deepEqual(await requestSession('GET',fake(true,{authenticated:true})),{ok:true,data:{authenticated:true}});
 assert.equal((await requestSession('GET',fake(true,{authenticated:true,token:'private-token'}))).code,'INVALID_RESPONSE');
 const forbidden=await requestSession('GET',fake(false,{error:{code:'FORBIDDEN',message:'private-secret'}}));assert.equal(forbidden.code,'FORBIDDEN');assert.ok(!forbidden.message.includes('private-secret'));
 assert.equal((await requestSession('GET',async()=>{throw new Error('private-network');})).code,'NETWORK_ERROR');
 assert.equal((await requestSession('GET',fake(false,{error:{code:'UNKNOWN'}}))).code,'INVALID_RESPONSE');
});
