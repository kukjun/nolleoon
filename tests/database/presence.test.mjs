import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openSqlite,migrate,SqliteUnitOfWork} from '../../apps/api/dist/infrastructure/sqlite/index.js';
import {Rooms} from '../../apps/api/dist/application/rooms.js';import {SecureTokens} from '../../apps/api/dist/infrastructure/sessions/secure-tokens.js';
test('서버 감지 시각부터 단절·멱등 sweep·heartbeat 복귀·퇴장자는 미복구',()=>{
 const dir=mkdtempSync(join(tmpdir(),'trip-presence-'));const db=openSqlite(join(dir,'test.sqlite'));let now=1000;
 try{migrate(db);const uow=new SqliteUnitOfWork(db);uow.run(r=>r.sessions.insert({id:'s',tokenHash:'h',createdAt:1,expiresAt:999999}));const rooms=new Rooms(uow,{now:()=>now},new SecureTokens());const first=rooms.create({id:'s'},'방장');
 assert.equal(first.members[0].connected,true);assert.equal(first.version,0);
 now=15999;rooms.sweep();assert.equal(rooms.read({id:'s'},first.inviteCode).members[0].connected,true);
 now=17000;rooms.sweep();const offline=rooms.read({id:'s'},first.inviteCode);assert.equal(offline.members[0].connected,false);assert.equal(offline.version,1);assert.equal(db.prepare('SELECT disconnected_at FROM room_members').get().disconnected_at,17000);
 now=999999;rooms.sweep();assert.equal(rooms.read({id:'s'},first.inviteCode).version,1);assert.equal(db.prepare('SELECT left_at FROM room_members').get().left_at,null);
 const online=rooms.heartbeat({id:'s'},first.inviteCode);assert.equal(online.members[0].connected,true);assert.equal(online.version,2);assert.equal(rooms.heartbeat({id:'s'},first.inviteCode).version,2);
 db.prepare('UPDATE room_members SET left_at=?').run(now);assert.throws(()=>rooms.heartbeat({id:'s'},first.inviteCode),e=>e.code==='FORBIDDEN');assert.equal(db.prepare('SELECT left_at FROM room_members').get().left_at,now);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test('v1 참가자 보존 후 last_seen을 가입시각으로 backfill한다',async()=>{
 const {migrations}=await import('../../apps/api/dist/infrastructure/sqlite/index.js');
 const dir=mkdtempSync(join(tmpdir(),'trip-presence-upgrade-'));const db=openSqlite(join(dir,'test.sqlite'));
 try{migrate(db,migrations.slice(0,1));db.exec("INSERT INTO sessions VALUES ('s','h',1,100000);INSERT INTO rooms(id,invite_code,status,version,created_at) VALUES ('r','invite','open',0,10);INSERT INTO room_members(id,room_id,session_id,nickname,nickname_key,joined_at) VALUES ('m','r','s','이름','이름',123);");migrate(db);assert.deepEqual(db.prepare('SELECT nickname,last_seen_at,disconnected_at FROM room_members').get(),{nickname:'이름',last_seen_at:123,disconnected_at:null});migrate(db);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM room_members').get().n,1);}finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
