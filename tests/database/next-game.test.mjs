import test from 'node:test';import assert from 'node:assert/strict';
import {votingFixture} from '../support/voting-fixture.mjs';import {openSqlite,SqliteUnitOfWork} from '../../apps/api/dist/infrastructure/sqlite/index.js';import {NextGame} from '../../apps/api/dist/application/next-game.js';import {firstCandidateRandom} from '../support/fakes.mjs';
test('다음 준비 전체 rollback과 저장소 재개방 receipt 불변을 검증한다',async()=>{
 const f=await votingFixture();let db;try{
  db=openSqlite(f.dbPath);db.prepare("UPDATE games SET status='result' WHERE id=?").run(f.s.game.gameId);let uow=new SqliteUnitOfWork(db);const actor=db.prepare('SELECT session_id id FROM room_members WHERE id=?').get(f.s.self.memberId);
  const body={requestId:'db-next-prepare-001',fromGameId:f.s.game.gameId,expectedPreparationVersion:0};const before={room:db.prepare('SELECT * FROM rooms').get(),draft:db.prepare('SELECT * FROM drafts').get(),members:db.prepare('SELECT * FROM room_members ORDER BY id').all()};
  const failing={run:work=>uow.run(r=>work({...r,nextPreparations:{...r.nextPreparations,insert(){throw new Error('receipt write failure');}}}))};
  assert.throws(()=>new NextGame(failing,{now:()=>1000},firstCandidateRandom).execute(actor,f.s.inviteCode,body),/receipt write failure/);
  assert.deepEqual({room:db.prepare('SELECT * FROM rooms').get(),draft:db.prepare('SELECT * FROM drafts').get(),members:db.prepare('SELECT * FROM room_members ORDER BY id').all()},before);
  const original=new NextGame(uow,{now:()=>1000},firstCandidateRandom).execute(actor,f.s.inviteCode,body);const current=db.prepare('SELECT * FROM rooms').get();
  assert.throws(()=>db.exec('UPDATE next_preparation_receipts SET preparation_version=10'),/immutable/);assert.throws(()=>db.exec('DELETE FROM next_preparation_receipts'),/immutable/);
  db.close();db=openSqlite(f.dbPath);uow=new SqliteUnitOfWork(db);assert.deepEqual(new NextGame(uow,{now:()=>2000},firstCandidateRandom).execute(actor,f.s.inviteCode,body),original);assert.deepEqual(db.prepare('SELECT * FROM rooms').get(),current);
 }finally{db?.close();await f.close();}
});
