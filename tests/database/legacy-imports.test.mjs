import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openSqlite,migrate,SqliteUnitOfWork} from '../../apps/api/dist/infrastructure/sqlite/index.js';
import {LegacyImports} from '../../apps/api/dist/application/legacy-imports.js';import {Rooms} from '../../apps/api/dist/application/rooms.js';import {PartyGames} from '../../apps/api/dist/application/party-games.js';import {AccountAuth} from '../../apps/api/dist/application/account-auth.js';import {SecureTokens} from '../../apps/api/dist/infrastructure/sessions/secure-tokens.js';
async function setup(t){const dir=mkdtempSync(join(tmpdir(),'trip-legacy-link-')),path=join(dir,'test.sqlite');let db=openSqlite(path);migrate(db);let now=1000;const clock={now:()=>now},codec=new SecureTokens(),random={nextInt:()=>0};let uow,rooms,party,legacy;const build=()=>{uow=new SqliteUnitOfWork(db);rooms=new Rooms(uow,clock,codec,random);party=new PartyGames(uow,clock,codec,random);legacy=new LegacyImports(uow,clock,codec,party,rooms);};build();t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});const tokens=Array.from({length:4},()=>codec.token()),ids=['s1','s2','s3','s4'];uow.run(r=>tokens.forEach((token,i)=>r.sessions.insert({id:ids[i],tokenHash:codec.hash(token),createdAt:0,expiresAt:100000})));const room=rooms.create({id:ids[0]},'방장');for(let i=1;i<3;i++)rooms.join({id:ids[i]},room.inviteCode,'친구'+i);
 async function account(subject){const auth=new AccountAuth(uow,clock,codec,{authorizationUrl:s=>'https://kauth.kakao.com/oauth/authorize?state='+s,exchange:async()=>({subject})});const b=auth.begin('/travel');return (await auth.callback(b.state,b.browserToken,'code-'+subject)).account.id;}
 const a=await account('123'),b=await account('456');return {get db(){return db},get legacy(){return legacy},get party(){return party},get rooms(){return rooms},get uow(){return uow},a,b,room,ids,tokens,setNow:n=>now=n,reopen:()=>{db.close();db=openSqlite(path);migrate(db);build();},team(){party.select({id:ids[0]},room.inviteCode,{expectedVersion:0,type:'team',teamCount:2,winnerCount:1,penaltyText:''});return party.start({id:ids[0]},room.inviteCode,{requestId:'fixture-start-000001',expectedSelectionVersion:1}).runId;}};}
const legacyHash=db=>JSON.stringify(db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r=>r.name).filter(name=>!/^account|^travel|^oauth|^provider|^schema_migrations/.test(name)).map(name=>[name,db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()]));
test('explicit cookie-proven import is idempotent, atomic and separate from new travel rooms',async t=>{
 const f=await setup(t),run=f.team();assert.equal(f.db.prepare('SELECT count(*) n FROM account_legacy_links').get().n,0);assert.equal(f.legacy.preview(f.a,f.tokens[0]).items[0].runId,run);
 const before=legacyHash(f.db);assert.throws(()=>f.legacy.import(f.a,f.tokens[0],{runIds:[run,'nonexistent']}));assert.equal(f.legacy.list(f.a).items.length,0);
 const linked=f.legacy.import(f.a,f.tokens[0],{runIds:[run]});assert.deepEqual(f.legacy.import(f.a,f.tokens[0],{runIds:[run]}),linked);assert.equal(legacyHash(f.db),before);assert.equal(f.db.prepare('SELECT count(*) n FROM travel_rooms').get().n,0);
 assert.throws(()=>f.legacy.import(f.b,f.tokens[0],{runIds:[run]}),e=>e.code==='STATE_CONFLICT');assert.equal(f.legacy.import(f.b,f.tokens[1],{runIds:[run]}).items.length,1);assert.throws(()=>f.legacy.detail(f.b,linked.items[0].id));
 f.reopen();const detail=f.legacy.detail(f.a,linked.items[0].id);assert.equal(detail.party.result.kind,'team');assert.equal(detail.party.result.assignments.length,3);assert.equal(JSON.stringify(detail).includes('legacySessionId'),false);
});
test('nickname, invite, forged/expired cookie and late post-game room member cannot prove old records',async t=>{
 const f=await setup(t),run=f.team();f.rooms.join({id:f.ids[3]},f.room.inviteCode,'같은 이름');for(const token of [undefined,'s1',f.room.inviteCode,'x'.repeat(43)])assert.throws(()=>f.legacy.import(f.a,token,{runIds:[run]}));assert.throws(()=>f.legacy.import(f.a,f.tokens[3],{runIds:[run]}),e=>e.code==='FORBIDDEN');
 f.setNow(100000);assert.throws(()=>f.legacy.preview(f.a,f.tokens[0]));assert.throws(()=>f.legacy.import(f.a,f.tokens[0],{runIds:[run]}));assert.equal(f.db.prepare('SELECT count(*) n FROM account_legacy_links').get().n,0);
});
test('native insert failure rolls back all selected links; closed legacy data remains unchanged',async t=>{
 const f=await setup(t),run=f.team();f.rooms.close({id:f.ids[0]},f.room.inviteCode,f.room.self.memberId);const before=legacyHash(f.db);f.db.exec("CREATE TRIGGER fixture_block_link BEFORE INSERT ON account_legacy_links BEGIN SELECT RAISE(ABORT,'fixture failure'); END");assert.throws(()=>f.legacy.import(f.a,f.tokens[0],{runIds:[run]}));assert.equal(f.legacy.list(f.a).items.length,0);f.db.exec('DROP TRIGGER fixture_block_link');const link=f.legacy.import(f.a,f.tokens[0],{runIds:[run]}).items[0];f.legacy.detail(f.a,link.id);assert.equal(legacyHash(f.db),before);
});
for(const cause of ['defendant-left','legacy-private','room-closed'])test('linked interrupted trial keeps original disclosure '+cause,async t=>{
 const f=await setup(t);f.db.prepare("INSERT INTO games VALUES ('private-court',?,'interrupted','비공개 사건','비공개 벌칙',180,0,1000)").run(f.room.roomId);f.db.prepare('INSERT INTO game_participants VALUES (?,?,?,?,?)').run('private-court',f.room.roomId,f.room.self.memberId,'defendant',0);f.db.prepare('INSERT INTO game_interruptions VALUES (?,?,?)').run('private-court',cause,1001);
 const before=legacyHash(f.db);const link=f.legacy.import(f.a,f.tokens[0],{runIds:['private-court']}).items[0];const detail=f.legacy.detail(f.a,link.id);assert.equal(detail.party,null);assert.equal(detail.court.game,null);assert.equal(JSON.stringify(detail).includes('비공개 벌칙'),false);assert.equal(JSON.stringify(detail).includes('비공개 사건'),cause==='room-closed');assert.equal(legacyHash(f.db),before);
});
test('keyset preview/list pagination uses owned anchors and observer links keep results hidden',async t=>{
 const f=await setup(t);const ids=Array.from({length:26},(_,i)=>'archive-'+String(i).padStart(2,'0'));f.uow.run(r=>{for(const runId of ids){r.party.insertRun({id:runId,roomId:f.room.roomId,type:'team',status:'completed',version:0,settingsJson:'{"teamCount":2}',createdAt:1000});r.party.addParticipant({runId,roomId:f.room.roomId,memberId:f.room.self.memberId,nickname:'방장',eligible:false});}});
 const first=f.legacy.preview(f.a,f.tokens[0]),second=f.legacy.preview(f.a,f.tokens[0],first.nextCursor);assert.equal(first.items.length,20);assert.equal(second.items.length,6);assert.equal(new Set([...first.items,...second.items].map(x=>x.runId)).size,26);
 f.legacy.import(f.a,f.tokens[0],{runIds:ids.slice(0,20)});f.legacy.import(f.a,f.tokens[0],{runIds:ids.slice(20)});const one=f.legacy.list(f.a),two=f.legacy.list(f.a,one.nextCursor);assert.equal(one.items.length,20);assert.equal(two.items.length,6);assert.equal(new Set([...one.items,...two.items].map(x=>x.id)).size,26);assert.throws(()=>f.legacy.list(f.b,one.nextCursor),e=>e.code==='NOT_FOUND');const detail=f.legacy.detail(f.a,one.items[0].id);assert.equal(detail.party.result,null);assert.equal(detail.party.self.eligible,false);
});

test('preview and linked list expose original run creation time only, never import time or private content',async t=>{
 const f=await setup(t);f.setNow(1234);const run=f.team();f.setNow(5678);
 const preview=f.legacy.preview(f.a,f.tokens[0]).items[0];
 assert.equal(preview.createdAt,1234);
 assert.deepEqual(Object.keys(preview).sort(),['createdAt','linkState','runId','status','type']);
 f.legacy.import(f.a,f.tokens[0],{runIds:[run]});f.reopen();
 const linked=f.legacy.list(f.a).items[0];assert.equal(linked.createdAt,1234);
 assert.deepEqual(Object.keys(linked).sort(),['createdAt','id','runId','status','type']);
 assert.equal(f.legacy.preview(f.b,f.tokens[3]).items.length,0);
});
