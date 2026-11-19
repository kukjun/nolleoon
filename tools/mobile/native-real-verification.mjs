/** Explicit local verification only. Importing this module never starts a server. */
import 'reflect-metadata';
import {NestFactory} from '@nestjs/core';
import {constants,openSync,closeSync,fstatSync,readFileSync,mkdtempSync,mkdirSync,lstatSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {AppModule} from '../../apps/api/dist/composition/app.module.js';
import {KakaoNativeTokenVerifier} from '../../apps/api/dist/infrastructure/auth/native-kakao-verifier.js';
import {DurableDeletionLedger,DurableRoomDeletionLedger,initializeDeletionLedger} from '../../apps/api/dist/infrastructure/deletion/durable-ledger.js';
import {DurableKakaoUnlinkOutbox,initializeUnlinkOutbox} from '../../apps/api/dist/infrastructure/auth/kakao-unlink-outbox.js';
const origin='http://127.0.0.1:4189';
const root=join(homedir(),'Library','Application Support','Nolleoon','native-auth-test');
export function loadExpectedAppId(path){
 let fd;
 try{
  fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  const stat=fstatSync(fd);
  if(!stat.isFile()||(stat.mode&0o777)!==0o600||stat.uid!==process.getuid()||stat.size>16384)throw new Error();
  const bytes=readFileSync(fd);
  try{
   const entries=bytes.toString('utf8').split(/\r?\n/).filter(line=>/^\s*(?:export\s+)?KAKAO_APP_ID\s*=/.test(line));
   if(entries.length!==1)throw new Error();
   const match=/^KAKAO_APP_ID=([1-9][0-9]*)$/.exec(entries[0]);
   const id=match?Number(match[1]):NaN;
   if(!Number.isSafeInteger(id)||id<=0)throw new Error();
   return {expectedAppId:id};
  }finally{bytes.fill(0);}
 }catch{throw new Error('Private app ID configuration unavailable');}
 finally{if(fd!==undefined)closeSync(fd);}
}
export function permittedLocalRequest(method,url){
 if(method==='POST')return ['/api/native/auth/kakao','/api/native/auth/logout','/api/native/travel-rooms'].includes(url);
 if(method!=='GET')return false;
 return ['/api/native/account/session','/api/native/travel-rooms'].includes(url)||/^\/api\/native\/travel-rooms\/[A-Za-z0-9_-]{1,128}$/.test(url);
}
function authorities(directory){
 const a=join(directory,'account'),ac=join(directory,'account-anchor'),r=join(directory,'room'),rc=join(directory,'room-anchor');
 initializeDeletionLedger(a,ac);initializeDeletionLedger(r,rc);
 const p=join(directory,'unlink-pending'),j=join(directory,'unlink-journal'),c=join(directory,'unlink-anchor');
 initializeUnlinkOutbox(p,j,c);
 return {deletionLedger:new DurableDeletionLedger(a,ac),roomDeletionLedger:new DurableRoomDeletionLedger(r,rc),kakaoUnlinkOutbox:new DurableKakaoUnlinkOutbox(p,j,c)};
}
export async function startRealVerification(options={}){
 if(options.explicit!==true||Object.keys(options).some(k=>!['explicit','fixture','configPath'].includes(k)))throw new Error('Explicit isolated verification required');
 const fixture=options.fixture;
 if(fixture&&(!fixture.parent||typeof fixture.fetcher!=='function'||Object.keys(fixture).some(k=>!['parent','fetcher'].includes(k))))throw new Error('Invalid synthetic fixture');
 if(!fixture&&options.configPath!==undefined)throw new Error('Configuration override forbidden');
 const configuration=loadExpectedAppId(fixture?options.configPath:join(root,'native-kakao.env'));
 const parent=fixture?fixture.parent:root;
 const parentStat=lstatSync(parent);
 if(!parentStat.isDirectory()||parentStat.isSymbolicLink()||parentStat.uid!==process.getuid())throw new Error('Private storage parent unavailable');
 const directory=mkdtempSync(join(parent,'verification-run-'));
 let app,closed=false;
 const close=async()=>{if(closed)return;closed=true;if(app)await app.close();};
 try{
  mkdirSync(join(directory,'authority'),{mode:0o700});
  app=await NestFactory.create(AppModule.register({
   dbPath:join(directory,'verification.sqlite'),publicOrigin:origin,
   nativeKakaoVerifier:new KakaoNativeTokenVerifier(configuration,fixture?.fetcher??fetch),
   ...authorities(join(directory,'authority')),
   presenceMonitor:false,settlementMonitor:false,roomDeletionMonitor:false,unlinkMonitor:false,
  }),{logger:false,abortOnError:false});
  // Installed before route/body-parser processing; raw URL exact matching rejects
  // aliases, encoded separators, query suffixes and every non-allowlisted method.
  app.use((req,res,next)=>{
   res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
   if(!permittedLocalRequest(req.method,req.originalUrl??req.url)){res.status(404).end();return;}
   next();
  });
  app.setGlobalPrefix('api');await app.listen(fixture?0:4189,'127.0.0.1');
  return {url:await app.getUrl(),directory,close};
 }catch{await close();throw new Error('Local verification unavailable; retained storage is not automatically deleted');}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==3||process.argv[2]!=='--local-real-verification'){
  process.stderr.write('Requires --local-real-verification. No config/path/port overrides.\n');process.exitCode=1;
 }else{
  try{
   const server=await startRealVerification({explicit:true});
   process.stdout.write('Local verification on 127.0.0.1:4189. New private storage retained after shutdown.\n');
   for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.close().then(()=>process.exit(0),()=>process.exit(1));});
  }catch{process.stderr.write('Local verification could not start. No production fallback or automatic data removal.\n');process.exitCode=1;}
 }
}
