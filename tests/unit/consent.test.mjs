import test from 'node:test';import assert from 'node:assert/strict';import {consentStatus,hasCurrentAcceptance,validateConsent} from '../../apps/api/dist/application/penalty-consent.js';
test('시작 수락 helper는 현피고·현역할/벌칙revision·비어있지않은 벌칙을 함께 확인한다',()=>{
 const context={memberId:'m',roleRevision:2,penaltyRevision:3,penaltyText:'벌칙'};const record={roomId:'r',memberId:'m',roleRevision:2,penaltyRevision:3,version:4,decision:'accepted'};
 assert.equal(hasCurrentAcceptance(context,record),true);
 for(const delta of [{memberId:null},{memberId:'other'},{roleRevision:4},{penaltyRevision:5},{penaltyText:' '}])assert.equal(consentStatus({...context,...delta},record),'pending');assert.equal(hasCurrentAcceptance(context,{...record,decision:'rejected'}),false);
 for(const input of [null,[],{}, {decision:['accepted'],expectedDecisionVersion:0,roleRevision:0,penaltyRevision:0},{decision:'accepted',expectedDecisionVersion:-1,roleRevision:0,penaltyRevision:0}])assert.throws(()=>validateConsent(input),e=>e.code==='INVALID_INPUT');
});
