import {firstCandidateRandom} from '../support/fakes.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {votingFixture} from '../support/voting-fixture.mjs';
import {openSqlite,SqliteUnitOfWork} from '../../apps/api/dist/infrastructure/sqlite/index.js';
import {SubmitVote} from '../../apps/api/dist/application/submit-vote.js';

test('실제 DB 투표 rollback·재시작 receipt·마감과 라운드 경계·공용 버전 불변',async()=>{
 const f=await votingFixture();let db;
 try {
  await f.post(`games/${f.s.game.gameId}/open-vote`,f.cookies[0],{roundNumber:1,expectedVersion:0,requestId:'db-vote-opening-0001'});
  db=openSqlite(f.dbPath);let now=2000;const clock={now:()=>now};let uow=new SqliteUnitOfWork(db);
  const gameId=f.s.game.gameId;const members=db.prepare('SELECT session_id AS id,id AS memberId FROM room_members ORDER BY joined_at,rowid').all();
  const actor=members[1];const body={roundNumber:1,requestId:'db-submit-vote-0001',choice:'guilty',reason:'  실제 접수  '};
  const versions=()=>db.prepare('SELECT r.version AS room,g.version AS game FROM rooms r JOIN games g ON g.room_id=r.id').get();const initial=versions();
  const failing={run:work=>uow.run(r=>work({...r,votes:{...r.votes,insert(v){r.votes.insert(v);throw new Error('after insert failure');}}}))};
  assert.throws(()=>new SubmitVote(failing,clock,firstCandidateRandom).execute(actor,f.s.inviteCode,gameId,body),/after insert failure/);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM votes').get().n,0);
  new SubmitVote(uow,clock,firstCandidateRandom).execute(actor,f.s.inviteCode,gameId,body);assert.deepEqual(versions(),initial);
  db.close();db=openSqlite(f.dbPath);uow=new SqliteUnitOfWork(db);now=181000;const voter=new SubmitVote(uow,clock,firstCandidateRandom);
  voter.execute(actor,f.s.inviteCode,gameId,{...body,reason:'실제 접수'});assert.equal(db.prepare('SELECT COUNT(*) AS n FROM votes').get().n,1);
  assert.throws(()=>voter.execute(members[2],f.s.inviteCode,gameId,{...body,requestId:'db-expired-vote-0001'}),e=>e.code==='DEADLINE_PASSED');
  now=2000;db.prepare('UPDATE rounds SET closed_at=1900 WHERE game_id=?').run(gameId);
  assert.throws(()=>voter.execute(members[2],f.s.inviteCode,gameId,{...body,requestId:'db-closed-vote-0001'}),e=>e.code==='STATE_CONFLICT');
  db.prepare('INSERT INTO rounds(game_id,number,started_at,deadline) VALUES (?,2,2000,182000)').run(gameId);
  // 새 2차 투표를 합성하는 저장소 fixture: 이전 마감 유지보수로 종료된 game도 voting으로 맞춘다.
  db.prepare("UPDATE games SET status='voting' WHERE id=?").run(gameId);
  assert.throws(()=>voter.execute(members[2],f.s.inviteCode,gameId,{...body,requestId:'db-oldround-vote-0001'}),e=>e.code==='STATE_CONFLICT');
  assert.deepEqual(voter.execute(actor,f.s.inviteCode,gameId,body),{gameId,roundNumber:1,choice:'guilty',reason:'실제 접수'});
  let boundary=181999;new SubmitVote(uow,{now:()=>boundary++},firstCandidateRandom).execute(members[2],f.s.inviteCode,gameId,{...body,roundNumber:2,requestId:'db-second-vote-0001',choice:'abstain',reason:''});
  assert.equal(db.prepare('SELECT submitted_at AS at FROM votes WHERE round_number=2').get().at,181999);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM votes').get().n,2);
  const replay=await f.post(`games/${gameId}/vote`,f.cookies[1],body);assert.equal(replay.status,201);
  const replayBody=await replay.json();assert.equal(replayBody.receipt.roundNumber,1);assert.equal(replayBody.snapshot.game.round.number,2);assert.equal(replayBody.snapshot.game.ownVote,null);
  // 이전 멤버십을 떠나 재입장한 관전자는 예전 표의 receipt도 명령으로 되살리지 않는다.
  db.prepare('UPDATE room_members SET left_at=2000 WHERE id=?').run(actor.memberId);
  assert.throws(()=>voter.execute(actor,f.s.inviteCode,gameId,body),e=>e.code==='FORBIDDEN');
 }finally{if(db?.open)db.close();await f.close();}
});
