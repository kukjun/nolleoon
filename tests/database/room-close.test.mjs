import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openSqlite,migrate,migrations,SqliteUnitOfWork} from '../../apps/api/dist/infrastructure/sqlite/index.js';
import {votingFixture} from '../support/voting-fixture.mjs';
import {Rooms} from '../../apps/api/dist/application/rooms.js';import {SecureTokens} from '../../apps/api/dist/infrastructure/sessions/secure-tokens.js';import {firstCandidateRandom} from '../support/fakes.mjs';

test('v8는 과거 중단을 비공개 원인으로 보존하고 원인/방종료 기록 변경을 거부한다',()=>{
 const dir=mkdtempSync(join(tmpdir(),'trip-close-migration-'));const db=openSqlite(join(dir,'test.sqlite'));try{
  migrate(db,migrations.slice(0,7));db.exec("INSERT INTO rooms(id,invite_code,status,version,created_at) VALUES ('r','invite','open',0,1);INSERT INTO games(id,room_id,status,case_text,penalty_text,duration_seconds,version,created_at) VALUES ('g','r','interrupted','private case','private penalty',180,1,1)");
  migrate(db);assert.equal(db.prepare('SELECT cause FROM game_interruptions').get().cause,'legacy-private');migrate(db);
  assert.throws(()=>db.exec("UPDATE game_interruptions SET cause='room-closed'"),/immutable/);assert.throws(()=>db.exec('DELETE FROM game_interruptions'),/immutable/);
  db.prepare('INSERT INTO room_closures VALUES (?, ?, NULL)').run('r',1000);assert.throws(()=>db.exec('UPDATE room_closures SET closed_at=2000'),/immutable/);assert.throws(()=>db.exec('DELETE FROM room_closures'),/immutable/);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test('방 종료 쓰기 실패는 중단과 원인도 rollback하고 재개방한 원래 actor만 재확인한다',async()=>{
 const f=await votingFixture(1);let db;try{
  db=openSqlite(f.dbPath);let uow=new SqliteUnitOfWork(db);const member=f.s.self.memberId;const actor=db.prepare('SELECT session_id id FROM room_members WHERE id=?').get(member);
  const broken={run:work=>uow.run(r=>work({...r,closures:{...r.closures,insert(){throw new Error('close write failure');}}}))};
  assert.throws(()=>new Rooms(broken,{now:()=>1000},new SecureTokens(),firstCandidateRandom).close(actor,f.s.inviteCode,member),/close write failure/);
  assert.equal(db.prepare('SELECT status FROM rooms').get().status,'open');assert.equal(db.prepare('SELECT status FROM games').get().status,'defense');assert.equal(db.prepare('SELECT COUNT(*) n FROM game_interruptions').get().n,0);
  new Rooms(uow,{now:()=>1000},new SecureTokens(),firstCandidateRandom).close(actor,f.s.inviteCode,member);const version=db.prepare('SELECT version FROM rooms').get().version;
  db.close();db=openSqlite(f.dbPath);uow=new SqliteUnitOfWork(db);const rooms=new Rooms(uow,{now:()=>2000},new SecureTokens(),firstCandidateRandom);assert.equal(rooms.close(actor,f.s.inviteCode,member).closed,true);assert.equal(db.prepare('SELECT version FROM rooms').get().version,version);
  const other=db.prepare('SELECT session_id id,id memberId FROM room_members WHERE id!=? LIMIT 1').get(member);assert.throws(()=>rooms.close(other,f.s.inviteCode,other.memberId),e=>e.code==='FORBIDDEN');
 }finally{db?.close();await f.close();}
});
