import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import {NestFactory} from '@nestjs/core';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import Database from 'better-sqlite3';
import {AppModule} from '../../apps/api/dist/composition/app.module.js';
import {backupDatabase,restoreDatabase} from '../../apps/api/dist/infrastructure/sqlite/backup.js';
import {emptyRestoreJournals} from '../support/restore-journals.mjs';

// Only provider verification is synthetic. Sessions, route auth, commands,
// engines, SQLite, durable privacy journals and restore are actual implementations.
test('native opaque-session journey crosses four games, privacy, deletion receipt and restore without resurrection',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'native-integrated-'));
 mkdirSync(join(dir,'authority'));
 const authorities=emptyRestoreJournals(join(dir,'authority')).options;
 const source=join(dir,'source.sqlite'),snapshot=join(dir,'before-delete.sqlite'),restored=join(dir,'restored.sqlite');
 const origin='https://native-journey.invalid';
 const verifier={verify:async token=>{
  assert.match(token,/^synthetic-provider-[abcde]$/);
  return {subject:String(10000+token.at(-1).charCodeAt(0)),expiresInSeconds:300};
 }};
 let app,db,base,seq=0;
 const corpus=[];
 const capture=(kind,name,value)=>{corpus.push({kind,name,value});return value;};
 async function stop(){if(db){db.close();db=null;}if(app){await app.close();app=null;}}
 async function boot(path){
  app=await NestFactory.create(AppModule.register({dbPath:path,publicOrigin:origin,
   nativeKakaoVerifier:verifier,deletionLedger:authorities.account.journal,roomDeletionLedger:authorities.rooms.journal,kakaoUnlinkOutbox:authorities.unlink.queue,
   presenceMonitor:false,settlementMonitor:false,roomDeletionMonitor:false,unlinkMonitor:false}),{logger:false,abortOnError:false});
  app.setGlobalPrefix('api');await app.listen(0,'127.0.0.1');base=(await app.getUrl())+'/api';db=new Database(path);
 }
 t.after(async()=>{await stop();rmSync(dir,{recursive:true,force:true});});
 await boot(source);
 const id=()=>`native-journey-${++seq}`;
 async function call(path,token,body,expected=body===undefined?200:201,headers={}){
  const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const value=await r.json();assert.equal(r.status,expected,`${path}: ${JSON.stringify(value)}`);assert.equal(r.headers.get('set-cookie'),null);return value;
 }
 const people={};
 for(const actor of ['a','b','c','d','e']){
  const login=await call('/native/auth/kakao',null,{accessToken:`synthetic-provider-${actor}`});
  assert.match(login.token,/^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(login.token,`synthetic-provider-${actor}`);
  people[actor]=login;
  capture('nativeSession',`session-${actor}`,await call('/native/account/session',login.token));
 }
 const req=(actor,path,body,expected)=>call(path,people[actor].token,body,expected);
 const room=capture('room','created',await req('a','/native/travel-rooms',{requestId:id(),title:'Synthetic native journey',startDate:null,endDate:null}));
 const root='/native/travel-rooms/'+room.roomId;
 const invite=await req('a',root+'/invite',{requestId:id(),expectedVersion:room.version});
 capture('invitePreview','minimal',await call('/native/travel-invites/'+invite.inviteToken+'/preview'));
 await req('e',root,undefined,403);
 for(const actor of ['b','c','d'])capture('room','joined-'+actor,await req(actor,'/native/travel-invites/'+invite.inviteToken+'/join',{requestId:id()}));
 const member={};for(const actor of ['a','b','c','d'])member[actor]=(await req(actor,root)).self.membershipId;
 const selected=['a','b','c'].map(a=>member[a]);
 const runs=[];
 async function create(type,settings){const current=await req('a',root);const run=await req('a',root+'/runs',{requestId:id(),expectedVersion:current.version,type,selectedMembershipIds:selected,settings});capture('run',type+'-draft',run);runs.push(run.runId);return run;}
 const path=run=>root+'/runs/'+run.runId;
 async function start(run){return capture('run',run.type+'-started',await req('a',path(run)+'/start',{requestId:id(),expectedVersion:run.version}));}
 async function action(run,actor,command,name){const latest=await req(actor,path(run));const value=await req(actor,path(run)+'/actions',{requestId:id(),expectedVersion:latest.version,command});return capture('run',name,value);}
 // Team is real allocation, not a fabricated test result. Observer sees public result.
 let run=await create('team',{teamCount:2});
 await req('b',path(run)+'/start',{requestId:id(),expectedVersion:run.version},403);
 run=await start(run);assert.equal(run.status,'completed');assert.equal(run.game.assignments.length,3);
 assert.deepEqual(run.game.assignments.map(a=>a.team).sort(),[1,1,2]);
 assert.deepEqual((await req('d',path(run))).game,run.game);
 // Draw only exposes individually revealed results, never internal allocations.
 run=await start(await create('draw',{winnerCount:1,penaltyText:'synthetic draw penalty'}));
 assert.deepEqual(run.game.revealed,[]);assert.equal(JSON.stringify(run).includes('allocations'),false);
 for(const actor of ['a','b','c'])run=await action(run,actor,{kind:'reveal'},'draw-reveal-'+actor);
 assert.equal(run.status,'completed');assert.equal(run.game.revealed.filter(r=>r.winner).length,1);
 // Menu candidate is private until all participants submit/pass.
 run=await start(await create('menu',{}));
 run=await action(run,'a',{type:'submit',menu:'synthetic private noodle'},'menu-own-candidate');
 const menuOther=capture('run','menu-other-private',await req('b',path(run)));
 assert.equal(JSON.stringify(menuOther).includes('synthetic private noodle'),false);
 run=await action(run,'b',{type:'pass'},'menu-pass-b');
 run=await action(run,'c',{type:'pass'},'menu-completed');assert.equal(run.game.result.menu,'synthetic private noodle');
 // Trial preserves first tie -> final defense -> second tie acquittal.
 run=await create('trial',{caseText:'synthetic private case',penaltyText:'synthetic trial penalty',durationMinutes:3,defendantMembershipId:member.a});
 await req('a',path(run)+'/start',{requestId:id(),expectedVersion:run.version},409);
 run=await action(run,'a',{action:'consent',decision:'accepted'},'trial-consent');
 run=await start(run);await req('d',path(run),undefined,403);
 run=await action(run,'a',{action:'defense',decision:'submit',text:'synthetic first defense'},'trial-first-defense');
 for(const round of [1,2]){
  run=await action(run,'a',{action:'begin-vote'},'trial-voting-'+round);
  run=await action(run,'b',{action:'vote',choice:'guilty',reason:`synthetic private reason ${round}`},'trial-own-vote-'+round);
  const other=capture('run','trial-other-private-'+round,await req('c',path(run)));
  assert.equal(JSON.stringify(other).includes(`synthetic private reason ${round}`),false);
  run=await action(run,'c',{action:'vote',choice:'not-guilty',reason:`synthetic acquittal ${round}`},'trial-round-result-'+round);
  if(round===1){assert.equal(run.game.phase,'first-result');run=await action(run,'a',{action:'final-defense'},'trial-final-defense-stage');run=await action(run,'a',{action:'defense',decision:'submit',text:'synthetic final defense'},'trial-final-defense');}
 }
 assert.equal(run.status,'completed');assert.equal(run.game.outcome,'not-guilty');assert.equal(run.game.rounds.length,2);
 const history=capture('runPage','participant-history',await req('b',root+'/history'));
 assert.equal(history.items.length,4);assert.equal(history.nextCursor,null);
 assert.equal((await req('d',root+'/history')).items.length,3);
 // Legacy web transport reads the same account/membership without native cookie fallback.
 const survivorWeb='v'.repeat(43);db.prepare('INSERT INTO account_sessions VALUES (?,?,?,1,?,NULL)').run(createHash('sha256').update(survivorWeb).digest('hex'),people.a.account.id,'synthetic-surviving-web',Date.now()+3600000);
 const web='w'.repeat(43);db.prepare('INSERT INTO account_sessions VALUES (?,?,?,1,?,NULL)').run(createHash('sha256').update(web).digest('hex'),people.b.account.id,'synthetic-web',Date.now()+3600000);
 const webRead=await call(root.replace('/native',''),null,undefined,200,{Cookie:'__Host-trip_account='+web});
 assert.deepEqual(webRead,await req('b',root));
 await call(root,null,undefined,403,{Cookie:'__Host-trip_account='+web});
 await call(root.replace('/native',''),people.b.token,undefined,403);
 // Restore an older snapshot AFTER deletion using current authoritative journals.
 await backupDatabase(source,snapshot);
 const deletion={requestId:id(),confirmation:'계정 탈퇴'};
 assert.deepEqual(await req('b','/native/account/delete',deletion),{deleted:true});
 assert.deepEqual(await req('b','/native/account/delete',deletion),{deleted:true});
 await req('b','/native/account/delete',{...deletion,requestId:id()},401);
 await req('b','/native/account/session',undefined,401);
 const redacted=capture('runPage','redacted-history',await req('a',root+'/history'));
 assert.equal(redacted.items.length,4);assert.ok(redacted.items.every(r=>r.game.redacted===true));
 for(const secret of ['synthetic private','synthetic trial penalty','synthetic first defense','synthetic final defense'])assert.equal(JSON.stringify(redacted).includes(secret),false);
 const options={account:{journal:authorities.account.journal,checkpoint:authorities.account.journal.checkpointValue()},rooms:{journal:authorities.rooms.journal,checkpoint:authorities.rooms.journal.checkpointValue()},unlink:{queue:authorities.unlink.queue,checkpoint:authorities.unlink.queue.witness()}};
 await stop();await restoreDatabase(snapshot,restored,options);await boot(restored);
 for(const actor of ['a','b','c','d','e'])await req(actor,'/native/account/session',undefined,401);
 assert.equal(db.prepare('SELECT count(*) n FROM native_account_sessions').get().n,0);
 assert.equal(db.prepare('SELECT count(*) n FROM native_account_deletion_receipts').get().n,0);
 assert.equal(db.prepare('SELECT status FROM accounts WHERE id=?').get(people.b.account.id).status,'disabled');
 // Deleted web identity is also revoked; no deleted free text is resurrected.
 await call('/account/session',null,undefined,401,{Cookie:'__Host-trip_account='+web});
 const fresh=await call('/native/auth/kakao',null,{accessToken:'synthetic-provider-a'});
 assert.equal(fresh.account.id,people.a.account.id);
 const survivingWebRoom=await call(root.replace('/native',''),null,undefined,200,{Cookie:'__Host-trip_account='+survivorWeb});
 assert.deepEqual(survivingWebRoom,await call(root,fresh.token));
 const after=capture('runPage','restored-redacted-history',await call(root+'/history',fresh.token));
 assert.deepEqual(after,redacted);assert.deepEqual(db.pragma('foreign_key_check'),[]);
 // Optional synthetic-only export for a separate real Dart DTO decoder check.
 // Never includes credentials, invite tokens, database rows or provider responses.
 const serialized=JSON.stringify({schemaVersion:1,provenance:'synthetic-provider-real-native-http-sqlite',records:corpus});
 for(const login of [...Object.values(people),fresh])assert.equal(serialized.includes(login.token),false);
 assert.equal(serialized.includes(invite.inviteToken),false);
 if(process.env.NOLLEOON_NATIVE_CORPUS_PATH){const output=process.env.NOLLEOON_NATIVE_CORPUS_PATH;assert.ok(isAbsolute(output));writeFileSync(output,serialized,{flag:'wx',mode:0o600});}
 assert.ok(corpus.length>=25);
});
