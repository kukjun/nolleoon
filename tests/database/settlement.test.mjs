import {firstCandidateRandom} from '../support/fakes.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {votingFixture} from '../support/voting-fixture.mjs';
import {openSqlite,migrate,SqliteUnitOfWork} from '../../apps/api/dist/infrastructure/sqlite/index.js';
import {SubmitVote} from '../../apps/api/dist/application/submit-vote.js';
import {SettleRounds} from '../../apps/api/dist/application/settle-round.js';
async function fixture(count=3){const f=await votingFixture(0,count);await f.post(`games/${f.s.game.gameId}/open-vote`,f.cookies[0],{roundNumber:1,expectedVersion:0,requestId:'db-settle-open-0001'});const db=openSqlite(f.dbPath);const members=db.prepare('SELECT session_id AS id,id AS memberId FROM room_members ORDER BY joined_at,rowid').all();return {...f,db,members,gameId:f.s.game.gameId};}
const vote=(key)=>({roundNumber:1,requestId:key,choice:'guilty',reason:'이유'});
test('G1 N0 A3·퇴장해도 고정 표 총수·중복 worker·재시작 불변',async()=>{const f=await fixture(5);let db=f.db;try{
 let uow=new SqliteUnitOfWork(db);new SubmitVote(uow,{now:()=>2000},firstCandidateRandom).execute(f.members[1],f.s.inviteCode,f.gameId,vote('db-tally-vote-0001'));
 db.prepare('UPDATE room_members SET left_at=3000 WHERE id=?').run(f.members[2].memberId);
 const sweep=new SettleRounds(uow,{now:()=>181000},firstCandidateRandom);assert.equal(sweep.sweep(),1);assert.equal(sweep.sweep(),0);
 const result=db.prepare('SELECT * FROM round_settlements').get();assert.equal(result.outcome,'guilty');assert.equal(result.total,4);assert.equal(result.abstain,3);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM votes').get().n,1);
 assert.throws(()=>db.prepare("UPDATE round_settlements SET outcome='not-guilty'").run(),/immutable/);assert.throws(()=>db.prepare('DELETE FROM round_settlements').run(),/immutable/);
 db.close();db=openSqlite(f.dbPath);migrate(db);uow=new SqliteUnitOfWork(db);assert.equal(new SettleRounds(uow,{now:()=>999999},firstCandidateRandom).sweep(),0);assert.deepEqual(db.prepare('SELECT * FROM round_settlements').get(),result);
 }finally{if(db.open)db.close();await f.close();}});
test('마지막 표 이후 정산 실패는 표·결과·상태 전체 rollback, 경계 뒤 새 표는 없다',async()=>{const f=await fixture();try{
 const uow=new SqliteUnitOfWork(f.db);const first=new SubmitVote(uow,{now:()=>2000},firstCandidateRandom);first.execute(f.members[1],f.s.inviteCode,f.gameId,vote('db-first-vote-0001'));
 const failing={run:work=>uow.run(r=>work({...r,rounds:{...r.rounds,close(){throw new Error('close failure');}}}))};
 assert.throws(()=>new SubmitVote(failing,{now:()=>3000},firstCandidateRandom).execute(f.members[2],f.s.inviteCode,f.gameId,vote('db-last-vote-0001')),/close failure/);
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM votes').get().n,1);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM round_settlements').get().n,0);assert.equal(f.db.prepare('SELECT status FROM games').get().status,'voting');assert.equal(f.db.prepare('SELECT closed_at FROM rounds').get().closed_at,null);
 assert.throws(()=>new SubmitVote(uow,{now:()=>181000},firstCandidateRandom).execute(f.members[2],f.s.inviteCode,f.gameId,vote('db-late-vote-0001')),e=>e.code==='DEADLINE_PASSED');
 assert.equal(new SettleRounds(uow,{now:()=>181000},firstCandidateRandom).sweep(),0);assert.equal(f.db.prepare('SELECT abstain FROM round_settlements').get().abstain,1);
 }finally{f.db.close();await f.close();}});
test('마지막 표 선착순과 마감 worker 선착순 모두 단일 불변 결과를 남긴다',async()=>{
 for(const lastWins of [true,false]){const f=await fixture();let second;try{
  const uow=new SqliteUnitOfWork(f.db);const voter=new SubmitVote(uow,{now:()=>180999},firstCandidateRandom);voter.execute(f.members[1],f.s.inviteCode,f.gameId,vote('db-race-first-0001'));
  second=openSqlite(f.dbPath);const worker=new SettleRounds(new SqliteUnitOfWork(second),{now:()=>181000},firstCandidateRandom);
  if(lastWins){voter.execute(f.members[2],f.s.inviteCode,f.gameId,vote('db-race-last-0001'));assert.equal(worker.sweep(),0);}else{assert.equal(worker.sweep(),1);assert.throws(()=>new SubmitVote(uow,{now:()=>181000},firstCandidateRandom).execute(f.members[2],f.s.inviteCode,f.gameId,vote('db-race-last-0001')),e=>e.code==='DEADLINE_PASSED');}
  assert.equal(worker.sweep(),0);const row=f.db.prepare('SELECT * FROM round_settlements').get();assert.equal(row.total,2);assert.equal(row.guilty,lastWins?2:1);assert.equal(row.abstain,lastWins?0:1);assert.equal(row.closed_by,lastWins?'all-submitted':'deadline');assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM round_settlements').get().n,1);
 }finally{second?.close();f.db.close();await f.close();}}
});
