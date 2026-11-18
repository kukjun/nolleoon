import {unlinkOutbox} from '../../apps/api/dist/production/unlink-outbox.js';
import {privacyLedgers} from '../../apps/api/dist/production/privacy-ledgers.js';
// Test-only owned child: synthetic DB, fixed clock/random, loopback HTTP or paused real transaction.
import 'reflect-metadata';
import {realpathSync,lstatSync,existsSync} from 'node:fs';
import {dirname,basename,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import {NestFactory} from '@nestjs/core';
import {AppModule} from '../../apps/api/dist/composition/app.module.js';
import {openSqlite,SqliteUnitOfWork} from '../../apps/api/dist/infrastructure/sqlite/index.js';
import {SubmitVote} from '../../apps/api/dist/application/submit-vote.js';
import {Rooms} from '../../apps/api/dist/application/rooms.js';
import {SecureTokens} from '../../apps/api/dist/infrastructure/sessions/secure-tokens.js';
const config=JSON.parse(process.argv[2]);const directory=realpathSync(dirname(config.dbPath));
if(!isAbsolute(config.dbPath)||dirname(directory)!==realpathSync(tmpdir())||!basename(directory).startsWith('trip-court-durability-')||!['test.sqlite','restored.sqlite'].includes(basename(config.dbPath))||(existsSync(config.dbPath)&&lstatSync(config.dbPath).isSymbolicLink()))throw new Error('durability child requires an owned temporary fixture path');
let now=config.now;let randomCalls=0;
const clock={now:()=>now};const random={nextInt:()=>{randomCalls++;return 0;}};
let app,db;
if(config.mode==='crash'){
 db=openSqlite(config.dbPath);const base=new SqliteUnitOfWork(db);
 function pause(stage){process.send({type:'staged',stage,inTransaction:db.inTransaction});Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5000);process.exit(90);}
 const uow={run:work=>base.run(r=>work({...r,
  votes:{...r.votes,insert(value){r.votes.insert(value);if(config.stage==='vote')pause('vote');}},
  settlements:{...r.settlements,insert(value){r.settlements.insert(value);if(config.stage==='finalize')pause('finalize');}},
  rooms:{...r.rooms,setHost(id,member){r.rooms.setHost(id,member);if(config.stage==='transfer'&&member!==null)pause('transfer');}}
 }))};
 process.on('message',message=>{if(message.type!=='execute')return;const actor=db.prepare('SELECT session_id id FROM room_members WHERE id=?').get(message.memberId);
  if(config.stage==='transfer')new Rooms(uow,clock,new SecureTokens(),random).leave(actor,message.code,message.memberId);
  else new SubmitVote(uow,clock,random).execute(actor,message.code,message.gameId,message.body);
  process.send({type:'unexpected-completion'});
 });
 process.send({type:'ready'});
}else{
 app=await NestFactory.create(AppModule.register({...unlinkOutbox(config.privacyEnv??{},config.dbPath,false,clock.now()),...privacyLedgers(config.privacyEnv??{},config.dbPath),dbPath:config.dbPath,publicOrigin:'https://trip.example',clock,random}),{logger:false,abortOnError:false});app.setGlobalPrefix('api');await app.listen(0,'127.0.0.1');
 process.on('message',async message=>{if(message.type==='clock'){now=message.now;process.send({type:'clock',now});}else if(message.type==='stats')process.send({type:'stats',randomCalls});else if(message.type==='close'){await app.close();process.exit(0);}});
 process.send({type:'ready',url:await app.getUrl(),randomCalls});
}
process.on('disconnect',()=>process.exit(0));
