import test from 'node:test';import assert from 'node:assert/strict';
import {setup} from '../support/party-fixture.mjs';import {openSqlite} from '../../apps/api/dist/infrastructure/sqlite/index.js';
test('팀 배정은 서버에 한 번 고정되고 동시시작·다른actor·새참여자의 과거결과를 차단한다',async()=>{
 const f=await setup();let db;try{
 await fetch(f.path+'/selection',f.command(f.cookies[0],{expectedVersion:0,type:'team',teamCount:2,winnerCount:1,penaltyText:'팀에는 남기지 않을 벌칙'},'PUT'));
 const request={requestId:'team-start-request-0001',expectedSelectionVersion:1};const responses=await Promise.all([fetch(f.path+'/start',f.command(f.cookies[0],request)),fetch(f.path+'/start',f.command(f.cookies[0],request))]);assert.deepEqual(responses.map(r=>r.status),[201,201]);const [a,b]=await Promise.all(responses.map(r=>r.json()));assert.equal(a.receipt.runId,b.receipt.runId);assert.equal(a.snapshot.run.type,'team');assert.equal(a.snapshot.run.status,'completed');assert.equal(a.snapshot.run.settings.penaltyText,'');const counts=[1,2].map(team=>a.snapshot.run.result.assignments.filter(x=>x.team===team).length);assert.deepEqual(counts.sort(),[2,3]);assert.equal(new Set(a.snapshot.run.result.assignments.map(x=>x.memberId)).size,5);
 assert.equal((await fetch(f.path+'/start',f.command(f.cookies[1],request))).status,403);assert.equal((await fetch(f.path+'/start',f.command(f.cookies[0],{...request,requestId:'team-start-request-0002'}))).status,409);
 const session=await fetch(`${f.url}/api/session`,f.command('',{}));const late=session.headers.get('set-cookie').split(';')[0];await fetch(`${f.url}/api/rooms/${f.created.inviteCode}/join`,f.command(late,{nickname:'늦은 참가'}));const stranger=await(await fetch(f.path,{headers:{cookie:late}})).json();assert.equal(stranger.run,null);assert.equal(stranger.selection.penaltyText,'');
 db=openSqlite(f.dbPath);assert.equal(db.prepare("SELECT COUNT(*) AS n FROM game_runs WHERE type='team'").get().n,1);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM run_allocations').get().n,5);
 }finally{db?.close();await f.close();}
});
