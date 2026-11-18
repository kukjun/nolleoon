import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateTravelLottery,canRevealTravelLot,publicTravelLotResults} from '../../apps/api/dist/domain/travel-lottery-policy.js';
const member=(memberId,revealed=false,disconnectedAt=null)=>({memberId,revealed,disconnectedAt,departure:'none'});
test('10분 경계는 만료가 flip보다 먼저이며 9:59 복귀는 새 offline 기간을 요구한다',()=>{
 const p=[member('a',false,1000),member('b',true)];
 assert.equal(evaluateTravelLottery('active',p,600999).status,'active');
 assert.equal(canRevealTravelLot('active',p,'a',600999),true);
 assert.deepEqual(evaluateTravelLottery('active',p,601000),{status:'incomplete',endedAt:601000,blockedPolicy:null});
 assert.equal(canRevealTravelLot('active',p,'a',601000),false);
 p[0].disconnectedAt=null;assert.equal(evaluateTravelLottery('active',p,601001).status,'active');
 p[0].disconnectedAt=601001;assert.equal(evaluateTravelLottery('active',p,1201000).status,'active');
});
test('공개한 사람의 offline은 중단하지 않고 가장 이른 미공개 만료만 선택한다',()=>{
 const p=[member('a',true,0),member('b',false,5000),member('c',false,1000)];
 assert.equal(evaluateTravelLottery('active',p,600000).status,'active');
 assert.equal(evaluateTravelLottery('active',p,900000).endedAt,601000);
 assert.equal(canRevealTravelLot('active',p,'missing',0),false);
 assert.equal(canRevealTravelLot('active',p,'a',0),false);
});
test('중복 timeout 및 완료/미완료 run은 terminal, 입력 membership은 불변이다',()=>{
 const p=[member('a',false,0),member('b',true)];const before=globalThis.structuredClone(p);
 const once=evaluateTravelLottery('active',p,600000);assert.equal(once.status,'incomplete');
 assert.equal(evaluateTravelLottery(once.status,p,900000).status,'incomplete');
 assert.equal(evaluateTravelLottery('completed',p,900000).status,'completed');
 assert.equal(canRevealTravelLot('incomplete',p,'a',900000),false);assert.deepEqual(p,before);
});
test('명시적 탈퇴/추방은 미확정 정책으로 fail closed한다',()=>{
 for(const departure of ['explicit','expelled']){const p=[{...member('a',false,0),departure},member('b')];assert.deepEqual(evaluateTravelLottery('active',p,900000),{status:'active',endedAt:null,blockedPolicy:'departure-policy-unresolved'});assert.equal(canRevealTravelLot('active',p,'b',900000),false);}
});
test('미완료 이력은 공개된 결과 allowlist만 유지하고 비공개값·내부열을 보내지 않는다',()=>{
 const rows=[{memberId:'a',winning:true,secret:'private'},{memberId:'b',winning:false,secret:'hidden'}];
 assert.deepEqual(publicTravelLotResults(rows,['a']),[{memberId:'a',winner:true}]);assert.deepEqual(publicTravelLotResults(rows,[]),[]);
 assert.equal(JSON.stringify(publicTravelLotResults(rows,['a'])).includes('hidden'),false);
});
