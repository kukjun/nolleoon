import test from 'node:test';
import assert from 'node:assert/strict';
import {travelGameHttpFixture} from '../support/travel-game-http-fixture.mjs';
test('cancelled draft trial returns renderable minimal phase without private content and frees its slot',async t=>{
 const f=await travelGameHttpFixture(t);
 const created=await f.create('trial',{caseText:'비공개 사건 내용',penaltyText:'비공개 벌칙 내용',durationMinutes:3,defendantMembershipId:f.ids.a});
 assert.equal(created.status,201);const run=created.body,path=f.root+'/runs/'+run.runId;
 const command={requestId:f.id(),expectedVersion:run.version};
 const cancelled=await f.call(path+'/cancel','a',command);
 assert.equal(cancelled.status,201);assert.equal(cancelled.body.status,'incomplete');
 assert.deepEqual(cancelled.body.game,{kind:'trial',restricted:true,phase:'interrupted'});
 for(const secret of ['비공개 사건 내용','비공개 벌칙 내용','caseText','penaltyText','votes','reasons'])assert.equal(JSON.stringify(cancelled.body).includes(secret),false);
 assert.deepEqual((await f.call(path+'/cancel','a',command)).body,cancelled.body);
 await f.restart();assert.deepEqual((await f.call(path,'b')).body.game,cancelled.body.game);
 assert.equal((await f.call(f.root+'/history','d')).body.items.length,0);
 assert.equal((await f.create('team',{teamCount:2})).status,201);
});
