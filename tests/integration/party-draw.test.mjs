import test from 'node:test';import assert from 'node:assert/strict';import {setup} from '../support/party-fixture.mjs';import {openSqlite} from '../../apps/api/dist/infrastructure/sqlite/index.js';
test('제비는 N명 사전 배정을 보존하고 본인에게도 공개 전 결과를 보내지 않는다',async()=>{
 const f=await setup(3);let db;try{
 await fetch(f.path+'/selection',f.command(f.cookies[0],{expectedVersion:0,type:'draw',teamCount:2,winnerCount:2,penaltyText:'저장한 벌칙 전문'},'PUT'));
 const body={requestId:'draw-allocation-start-01',expectedSelectionVersion:1};const response=await fetch(f.path+'/start',f.command(f.cookies[0],body));assert.equal(response.status,201);const start=await response.json();assert.equal(start.snapshot.run.status,'active');assert.deepEqual(start.snapshot.run.result,{kind:'draw',revealed:[]});
 for(const cookie of f.cookies){const view=await(await fetch(f.path,{headers:{cookie}})).json();assert.deepEqual(view.run.result.revealed,[]);assert.equal(view.run.self.revealed,false);assert.equal(JSON.stringify(view).includes('winning'),false);}
 db=openSqlite(f.dbPath);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM run_allocations WHERE winning=1').get().n,2);const before=db.prepare('SELECT * FROM run_allocations ORDER BY member_id').all();const retry=await(await fetch(f.path+'/start',f.command(f.cookies[0],body))).json();assert.equal(retry.receipt.runId,start.receipt.runId);assert.deepEqual(db.prepare('SELECT * FROM run_allocations ORDER BY member_id').all(),before);
 assert.equal((await fetch(f.path+'/selection',f.command(f.cookies[0],{expectedVersion:1,type:'team',teamCount:2,winnerCount:1,penaltyText:''},'PUT'))).status,409);
 }finally{db?.close();await f.close();}
});
