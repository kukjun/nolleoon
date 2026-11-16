import test from 'node:test';import assert from 'node:assert/strict';
import {votingFixture} from '../support/voting-fixture.mjs';import {openSqlite,migrate,SqliteUnitOfWork} from '../../apps/api/dist/infrastructure/sqlite/index.js';
import {TrialProgress} from '../../apps/api/dist/application/trial-progress.js';import {SubmitVote} from '../../apps/api/dist/application/submit-vote.js';import {Rooms} from '../../apps/api/dist/application/rooms.js';import {SecureTokens} from '../../apps/api/dist/infrastructure/sessions/secure-tokens.js';
test('2차 개시 rollback·재시작 동일마감·후발 제외·G1 A3 독립 집계',async()=>{const f=await votingFixture(0,5);let db=openSqlite(f.dbPath);try{
 let uow=new SqliteUnitOfWork(db);let now=1000;const clock={now:()=>now};const gameId=f.s.game.gameId;const actors=db.prepare('SELECT session_id AS id FROM room_members ORDER BY joined_at,rowid').all();
 new TrialProgress(uow,clock).open(actors[0],f.s.inviteCode,gameId,{roundNumber:1,expectedVersion:0,requestId:'db-first-open-0001'});
 const voter=new SubmitVote(uow,clock);for(let i=1;i<=4;i++)voter.execute(actors[i],f.s.inviteCode,gameId,{roundNumber:1,requestId:`db-first-vote-000${i}`,choice:i<=2?'guilty':'not-guilty',reason:`first reason ${i}`});
 assert.equal(db.prepare('SELECT status FROM games').get().status,'final-defense');const version=db.prepare('SELECT version FROM games').get().version;
 uow.run(r=>r.sessions.insert({id:'late',tokenHash:'late-hash',createdAt:0,expiresAt:999999}));const rooms=new Rooms(uow,clock,new SecureTokens());const late=rooms.join({id:'late'},f.s.inviteCode,'후발');assert.equal(late.game.self.eligible,false);assert.equal(late.game.self.role,'observer');
 const open={roundNumber:2,expectedVersion:version,requestId:'db-second-open-001'};const failing={run:work=>uow.run(r=>work({...r,opens:{...r.opens,insert(){throw new Error('second receipt failure');}}}))};
 assert.throws(()=>new TrialProgress(failing,clock).open(actors[0],f.s.inviteCode,gameId,open),/second receipt failure/);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM rounds').get().n,1);assert.equal(db.prepare('SELECT status FROM games').get().status,'final-defense');
 now=2000;new TrialProgress(uow,clock).open(actors[0],f.s.inviteCode,gameId,open);db.close();db=openSqlite(f.dbPath);migrate(db);uow=new SqliteUnitOfWork(db);now=5000;
 new TrialProgress(uow,clock).open(actors[0],f.s.inviteCode,gameId,open);assert.equal(db.prepare('SELECT deadline FROM rounds WHERE number=2').get().deadline,182000);
 const second=new SubmitVote(uow,clock);assert.throws(()=>second.execute({id:'late'},f.s.inviteCode,gameId,{roundNumber:2,requestId:'late-round2-vote1',choice:'guilty',reason:'late'}),e=>e.code==='FORBIDDEN');
 for(let i=1;i<=4;i++)second.execute(actors[i],f.s.inviteCode,gameId,{roundNumber:2,requestId:`db-second-vote-00${i}`,choice:i===1?'guilty':'abstain',reason:i===1?'second reason':''});
 const rounds=db.prepare('SELECT * FROM round_settlements ORDER BY round_number').all();assert.equal(rounds.length,2);assert.equal(rounds[0].outcome,'tie');assert.equal(rounds[1].outcome,'guilty');assert.equal(rounds[1].guilty,1);assert.equal(rounds[1].abstain,3);assert.equal(rounds[1].total,4);
 }finally{if(db.open)db.close();await f.close();}});
