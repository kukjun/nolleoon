import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openSqlite,migrate,SqliteUnitOfWork} from '../../apps/api/dist/infrastructure/sqlite/index.js';import {Rooms} from '../../apps/api/dist/application/rooms.js';import {SecureTokens} from '../../apps/api/dist/infrastructure/sessions/secure-tokens.js';
test('초안·방버전 저장 원자성 및 재시작 후 같은 초안 복구',()=>{
 const dir=mkdtempSync(join(tmpdir(),'trip-settings-'));const path=join(dir,'test.sqlite');let db=openSqlite(path);
 try{migrate(db);const uow=new SqliteUnitOfWork(db);uow.run(r=>r.sessions.insert({id:'s',tokenHash:'h',createdAt:0,expiresAt:999999}));const rooms=new Rooms(uow,{now:()=>10},new SecureTokens());const room=rooms.create({id:'s'},'나');const input={expectedVersion:0,caseText:'사건',penaltyText:'벌칙',durationMinutes:3};
 const failure={run:work=>uow.run(r=>work({...r,rooms:{...r.rooms,bumpVersion(){throw new Error('fixture failure');}}}))};assert.throws(()=>new Rooms(failure,{now:()=>10},new SecureTokens()).saveSettings({id:'s'},room.inviteCode,input),/fixture failure/);assert.equal(uow.run(r=>r.drafts.find(room.roomId)),undefined);assert.equal(rooms.read({id:'s'},room.inviteCode).version,0);
 const saved=rooms.saveSettings({id:'s'},room.inviteCode,input);db.close();db=openSqlite(path);migrate(db);assert.deepEqual(new Rooms(new SqliteUnitOfWork(db),{now:()=>20},new SecureTokens()).read({id:'s'},room.inviteCode).draft,saved.draft);
 }finally{if(db.open)db.close();rmSync(dir,{recursive:true,force:true});}
});
