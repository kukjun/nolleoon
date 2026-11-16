import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openSqlite,migrate,SqliteUnitOfWork} from '../../apps/api/dist/infrastructure/sqlite/index.js';
import {Rooms} from '../../apps/api/dist/application/rooms.js';
import {SecureTokens} from '../../apps/api/dist/infrastructure/sessions/secure-tokens.js';
test('방+첫 참가자+방장 원자성 및 다시 연 저장소의 초대 복구',()=>{
 const dir=mkdtempSync(join(tmpdir(),'trip-rooms-'));let db;
 try{
 const path=join(dir,'test.sqlite');db=openSqlite(path);migrate(db);const uow=new SqliteUnitOfWork(db);
 uow.run(r=>r.sessions.insert({id:'actor',tokenHash:'hash',createdAt:1,expiresAt:10000}));
 const failing={run:work=>uow.run(r=>work({...r,rooms:{...r.rooms,setHost:()=>{throw new Error('fixture interruption');}}}))};
 assert.throws(()=>new Rooms(failing,{now:()=>10},new SecureTokens()).create({id:'actor'},'호스트'),/fixture interruption/);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM rooms').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM room_members').get().n,0);
 const created=new Rooms(uow,{now:()=>10},new SecureTokens()).create({id:'actor'},'호스트');
 assert.equal(db.prepare('SELECT host_member_id FROM rooms').get().host_member_id,created.self.memberId);
 db.close();db=openSqlite(path);migrate(db);const recovered=new Rooms(new SqliteUnitOfWork(db),{now:()=>20},new SecureTokens()).read({id:'actor'},created.inviteCode);assert.deepEqual(recovered,created);
 }finally{if(db?.open)db.close();rmSync(dir,{recursive:true,force:true});}
});
