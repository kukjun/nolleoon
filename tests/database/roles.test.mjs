import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openSqlite,migrate,migrations,SqliteUnitOfWork} from '../../apps/api/dist/infrastructure/sqlite/index.js';import {Rooms} from '../../apps/api/dist/application/rooms.js';import {SecureTokens} from '../../apps/api/dist/infrastructure/sessions/secure-tokens.js';
test('대기 피고 unique·복귀와 제외 순서·피고제외 수락revision 무효화',()=>{
 const dir=mkdtempSync(join(tmpdir(),'trip-roles-'));const db=openSqlite(join(dir,'test.sqlite'));let now=1000;
 try{migrate(db);const uow=new SqliteUnitOfWork(db);uow.run(r=>{for(const id of ['h','g'])r.sessions.insert({id,tokenHash:id,createdAt:0,expiresAt:999999});});const rooms=new Rooms(uow,{now:()=>now},new SecureTokens());const room=rooms.create({id:'h'},'방장');const guest=rooms.join({id:'g'},room.inviteCode,'친구');const target=guest.self.memberId;
 const claimed=rooms.changeRole({id:'g'},room.inviteCode,'defendant');assert.equal(rooms.changeRole({id:'g'},room.inviteCode,'defendant').roleRevision,claimed.roleRevision);
 assert.throws(()=>uow.run(r=>r.members.setRole(room.self.memberId,'defendant')),e=>e.code==='constraint');
 now=16000;rooms.sweep();rooms.heartbeat({id:'g'},room.inviteCode);assert.throws(()=>rooms.excludeMember({id:'h'},room.inviteCode,target),e=>e.code==='STATE_CONFLICT');
 now=32000;rooms.sweep();const removed=rooms.excludeMember({id:'h'},room.inviteCode,target);assert.equal(removed.roleRevision,claimed.roleRevision+1);assert.throws(()=>rooms.heartbeat({id:'g'},room.inviteCode),e=>e.code==='FORBIDDEN');
 const newMember=rooms.join({id:'g'},room.inviteCode,'친구');assert.notEqual(newMember.self.memberId,target);assert.equal(rooms.changeRole({id:'g'},room.inviteCode,'defendant').roleRevision,removed.roleRevision+1);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
test('v2 저장 참가자는 v3에서 참가자 기본역할로 보존된다',()=>{
 const dir=mkdtempSync(join(tmpdir(),'trip-role-upgrade-'));const db=openSqlite(join(dir,'test.sqlite'));
 try{migrate(db,migrations.slice(0,2));db.exec("INSERT INTO sessions VALUES ('s','h',0,1000);INSERT INTO rooms(id,invite_code,status,version,created_at) VALUES ('r','i','open',0,0);INSERT INTO room_members(id,room_id,session_id,nickname,nickname_key,joined_at,last_seen_at) VALUES ('m','r','s','이름','이름',0,0);");migrate(db);assert.equal(db.prepare('SELECT role FROM room_members').get().role,'participant');assert.equal(db.prepare('SELECT role_revision FROM rooms').get().role_revision,0);}finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
