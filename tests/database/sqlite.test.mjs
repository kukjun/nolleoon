import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSqlite, migrate, SqliteUnitOfWork, StorageError, migrations } from '../../apps/api/dist/infrastructure/sqlite/index.js';
function fixture() {
 const directory=mkdtempSync(join(tmpdir(),'trip-court-sqlite-'));
 const path=join(directory,'test.sqlite'); const db=openSqlite(path,{busyTimeoutMs:20});
 return {db,path,uow:new SqliteUnitOfWork(db),close:()=>{db.close();rmSync(directory,{recursive:true,force:true});}};
}
function seed(repos) {
 repos.sessions.insert({id:'s',tokenHash:'synthetic-hash',createdAt:0,expiresAt:1000});
 repos.rooms.insert({id:'r',inviteCode:'synthetic-invite',status:'open',version:0,createdAt:0});
 repos.members.insert({id:'m',roomId:'r',sessionId:'s',nickname:'시험',nicknameKey:'시험',joinedAt:0});
 repos.games.insert({id:'g',roomId:'r',status:'draft',caseText:'시험 사건',penaltyText:'시험 벌칙',durationSeconds:180,version:0,createdAt:0});
 repos.participants.insert({gameId:'g',roomId:'r',memberId:'m',role:'participant',eligible:true});
 repos.rounds.insert({gameId:'g',number:1,startedAt:0,deadline:180000});
}
const vote={gameId:'g',roundNumber:1,memberId:'m',choice:'guilty',reason:'시험 이유',requestId:'request-1',submittedAt:10};
test('실제 SQLite 설치·PRAGMA·마이그레이션 재실행',()=>{
 const f=fixture();try{migrate(f.db);migrate(f.db);assert.equal(f.db.pragma('foreign_keys',{simple:true}),1);assert.equal(f.db.pragma('journal_mode',{simple:true}),'wal');assert.equal(f.db.pragma('busy_timeout',{simple:true}),20);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n,1);assert.ok(f.db.prepare('SELECT sqlite_version() AS v').get().v);}finally{f.close();}
});
test('중복 키·없는 FK·다른 게임 라운드 조합을 거절한다',()=>{
 const f=fixture();try{migrate(f.db);f.uow.run(seed);f.uow.run(r=>r.votes.insert(vote));assert.throws(()=>f.uow.run(r=>r.votes.insert({...vote,requestId:'different'})),e=>e instanceof StorageError&&e.code==='constraint');assert.throws(()=>f.uow.run(r=>r.votes.insert({...vote,memberId:'missing'})),e=>e.code==='constraint');assert.throws(()=>f.uow.run(r=>r.rounds.insert({gameId:'absent',number:1,startedAt:0,deadline:1})),e=>e.code==='constraint');assert.equal(f.uow.run(r=>r.votes.find('g',1,'m')).choice,'guilty');}finally{f.close();}
});
test('중간 실패는 전체 쓰기를 rollback한다',()=>{
 const f=fixture();try{migrate(f.db);assert.throws(()=>f.uow.run(r=>{seed(r);throw new Error('주입 실패');}),/주입 실패/);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0);}finally{f.close();}
});
test('실패한 다음 마이그레이션은 이전 스키마와 이력을 보존한다',()=>{
 const f=fixture();try{migrate(f.db);assert.throws(()=>migrate(f.db,[...migrations,{version:2,name:'failure',sql:'CREATE TABLE should_rollback(id TEXT); INSERT INTO absent VALUES (1);'}]));assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='should_rollback'").get().n,0);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n,1);}finally{f.close();}
});
test('게임·멤버십 키와 교차 방 참여를 보호한다',()=>{
 const f=fixture();try{migrate(f.db);f.uow.run(seed);
 assert.throws(()=>f.uow.run(r=>r.members.insert({id:'another',roomId:'r',sessionId:'s',nickname:'다른 이름',nicknameKey:'다른 이름',joinedAt:0})),e=>e.code==='constraint');
 assert.throws(()=>f.uow.run(r=>r.games.insert({id:'g',roomId:'r',status:'draft',caseText:'사건',penaltyText:'벌칙',durationSeconds:180,version:0,createdAt:0})),e=>e.code==='constraint');
 assert.throws(()=>f.uow.run(r=>r.participants.insert({gameId:'g',roomId:'r',memberId:'m',role:'participant',eligible:true})),e=>e.code==='constraint');
 assert.throws(()=>f.uow.run(r=>r.participants.insert({gameId:'g',roomId:'absent',memberId:'m',role:'participant',eligible:true})),e=>e.code==='constraint');
 }finally{f.close();}
});
test('두 라운드와 다음 게임은 표를 분리한다',()=>{
 const f=fixture();try{migrate(f.db);f.uow.run(seed);
 f.uow.run(r=>{r.votes.insert(vote);r.rounds.insert({gameId:'g',number:2,startedAt:180000,deadline:360000});r.votes.insert({...vote,roundNumber:2});});
 f.db.prepare("UPDATE games SET status='result' WHERE id='g'").run();
 f.uow.run(r=>{r.games.insert({id:'g2',roomId:'r',status:'draft',caseText:'다음 사건',penaltyText:'벌칙',durationSeconds:180,version:0,createdAt:1});r.participants.insert({gameId:'g2',roomId:'r',memberId:'m',role:'participant',eligible:true});r.rounds.insert({gameId:'g2',number:1,startedAt:0,deadline:180000});r.votes.insert({...vote,gameId:'g2'});});
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM votes').get().n,3);
 }finally{f.close();}
});
test('DB 락을 busy로 구분하고 잠금 해제 후 다시 쓸 수 있다',()=>{
 const f=fixture();let second;try{migrate(f.db);second=openSqlite(f.path,{busyTimeoutMs:20});f.db.exec('BEGIN IMMEDIATE');
 assert.throws(()=>new SqliteUnitOfWork(second).run(r=>r.rooms.insert({id:'locked',inviteCode:'locked',status:'open',version:0,createdAt:0})),e=>e instanceof StorageError&&e.code==='busy');
 f.db.exec('ROLLBACK');new SqliteUnitOfWork(second).run(r=>r.rooms.insert({id:'after',inviteCode:'after',status:'open',version:0,createdAt:0}));
 assert.equal(f.uow.run(r=>r.rooms.find('after')).id,'after');
 }finally{if(f.db.inTransaction)f.db.exec('ROLLBACK');second?.close();f.close();}
});
test('증분 업그레이드·순서·이미 적용한 SQL 변경을 검증한다',()=>{
 const f=fixture();try{migrate(f.db);const upgrade={version:2,name:'probe',sql:'CREATE TABLE migration_probe(id TEXT PRIMARY KEY) STRICT;'};migrate(f.db,[...migrations,upgrade]);migrate(f.db,[...migrations,upgrade]);
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n,2);
 assert.throws(()=>migrate(f.db,[...migrations,{...upgrade,sql:'SELECT 1;'}]),/변경/);
 assert.throws(()=>migrate(f.db,[...migrations,{version:4,name:'gap',sql:'SELECT 1;'}]),/순차/);
 }finally{f.close();}
});
test('초안 왕복과 재연결 후 저장값을 읽는다',()=>{
 const f=fixture();try{migrate(f.db);f.uow.run(seed);const draft={roomId:'r',caseText:'저장한 사건',penaltyText:'저장한 벌칙',durationSeconds:180,version:1};f.uow.run(r=>r.drafts.save(draft));
 const reopened=openSqlite(f.path);try{assert.deepEqual(new SqliteUnitOfWork(reopened).run(r=>r.drafts.find('r')),draft);}finally{reopened.close();}
 }finally{f.close();}
});
test('비동기 콜백과 트랜잭션 밖 저장소 핸들 사용을 거절한다',async()=>{
 const f=fixture();try{migrate(f.db);let leaked;
 f.uow.run(r=>{leaked=r;});assert.throws(()=>leaked.rooms.find('r'),/종료된/);
 assert.throws(()=>f.uow.run(async r=>{seed(r);await Promise.resolve();r.rooms.find('r');}),/동기/);
 await new Promise(ok=>setTimeout(ok,0));assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0);
 }finally{f.close();}
});
test('상대 경로와 잘못된 timeout은 DB 열기 전에 거절한다',()=>{
 assert.throws(()=>openSqlite('relative.sqlite'),/절대/);
 assert.throws(()=>openSqlite('/unused.sqlite',{busyTimeoutMs:-1}),/timeout/);
});

test('지원하지 않는 새 DB 스키마와 누락된 정의를 거절한다',()=>{
 const f=fixture();try{migrate(f.db);const next={version:2,name:'future',sql:'CREATE TABLE future_probe(id TEXT) STRICT;'};
 migrate(f.db,[...migrations,next]);assert.throws(()=>migrate(f.db),/지원하지 않는/);
 assert.throws(()=>migrate(f.db,[next]),/순차|정의/);
 }finally{f.close();}
});

test('존재하는 두 방 사이의 게임·멤버 연결도 복합 FK로 차단한다',()=>{
 const f=fixture();try{migrate(f.db);f.uow.run(seed);
 f.uow.run(r=>{
  r.sessions.insert({id:'s2',tokenHash:'synthetic-hash-2',createdAt:0,expiresAt:1000});
  r.rooms.insert({id:'r2',inviteCode:'synthetic-invite-2',status:'open',version:0,createdAt:0});
  r.members.insert({id:'m2',roomId:'r2',sessionId:'s2',nickname:'다른 참가자',nicknameKey:'다른 참가자',joinedAt:0});
 });
 assert.throws(()=>f.uow.run(r=>r.participants.insert({gameId:'g',roomId:'r',memberId:'m2',role:'participant',eligible:true})),e=>e.code==='constraint');
 assert.throws(()=>f.uow.run(r=>r.participants.insert({gameId:'g',roomId:'r2',memberId:'m2',role:'participant',eligible:true})),e=>e.code==='constraint');
 }finally{f.close();}
});
test('서로 다른 ID여도 한 방에 진행 게임은 하나다',()=>{
 const f=fixture();try{migrate(f.db);f.uow.run(seed);
 const next={id:'g2',roomId:'r',status:'draft',caseText:'다음 사건',penaltyText:'벌칙',durationSeconds:180,version:0,createdAt:1};
 assert.throws(()=>f.uow.run(r=>r.games.insert(next)),e=>e.code==='constraint');
 f.db.prepare("UPDATE games SET status='result' WHERE id='g'").run();
 f.uow.run(r=>r.games.insert(next));assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM games').get().n,2);
 }finally{f.close();}
});
test('서로 다른 참가자여도 한 게임에 피고는 하나다',()=>{
 const f=fixture();try{migrate(f.db);f.uow.run(seed);
 f.uow.run(r=>{
  for(const suffix of ['2','3']) {
   r.sessions.insert({id:'s'+suffix,tokenHash:'synthetic-hash-'+suffix,createdAt:0,expiresAt:1000});
   r.members.insert({id:'m'+suffix,roomId:'r',sessionId:'s'+suffix,nickname:'참가자'+suffix,nicknameKey:'참가자'+suffix,joinedAt:0});
  }
  r.participants.insert({gameId:'g',roomId:'r',memberId:'m2',role:'defendant',eligible:false});
 });
 assert.throws(()=>f.uow.run(r=>r.participants.insert({gameId:'g',roomId:'r',memberId:'m3',role:'defendant',eligible:false})),e=>e.code==='constraint');
 }finally{f.close();}
});
