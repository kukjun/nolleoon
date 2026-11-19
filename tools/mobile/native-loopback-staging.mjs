/** Explicit synthetic-only staging. Never accepts a database path or provider credentials. */
import 'reflect-metadata';
import {NestFactory} from '@nestjs/core';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {AppModule} from '../../apps/api/dist/composition/app.module.js';
import {emptyRestoreJournals} from '../../tests/support/restore-journals.mjs';

export async function startSyntheticStaging(options={}) {
  if(options.synthetic!==true || Object.keys(options).some(k=>!['synthetic','port'].includes(k)) || ![undefined,0,4188].includes(options.port)) throw new Error('Explicit isolated synthetic mode required');
  const directory=mkdtempSync(join(tmpdir(),'nolleoon-synthetic-staging-'));
  let app,closed=false;
  async function close(){
    if(closed)return;
    closed=true;
    try{if(app)await app.close();}finally{rmSync(directory,{recursive:true,force:true});}
  }
  try{
    mkdirSync(join(directory,'authority'));
    const authorities=emptyRestoreJournals(join(directory,'authority')).options;
    const nativeKakaoVerifier={verify:async token=>{
      if(typeof token!=='string'||!/^synthetic-provider-[abcde]$/.test(token))throw new Error('Synthetic credential required');
      return {subject:String(50000+token.charCodeAt(token.length-1)),expiresInSeconds:300};
    }};
    app=await NestFactory.create(AppModule.register({
      dbPath:join(directory,'synthetic.sqlite'),publicOrigin:'http://127.0.0.1:4188',
      nativeKakaoVerifier,
      kakaoUnlinkProvider:{unlink:async subject=>{
        if(!['50097','50098','50099','50100','50101'].includes(subject))throw new Error('Synthetic subject required');
        return {status:'unlinked'};
      }},
      deletionLedger:authorities.account.journal,
      roomDeletionLedger:authorities.rooms.journal,kakaoUnlinkOutbox:authorities.unlink.queue,
      presenceMonitor:true,settlementMonitor:true,roomDeletionMonitor:false,unlinkMonitor:false,
    }),{logger:false,abortOnError:false});
    app.setGlobalPrefix('api');
    await app.listen(options.port??0,'127.0.0.1');
    const url=await app.getUrl();
    if(!/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(url))throw new Error('Loopback binding required');
    return {url,directory,close};
  }catch(error){await close();throw error;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==3||process.argv[2]!=='--synthetic-only'){
    process.stderr.write('Requires --synthetic-only; no origin, path or credential options supported.\n');process.exitCode=1;
  }else{
    try{
      const fixture=await startSyntheticStaging({synthetic:true,port:4188});
      process.stdout.write(`SYNTHETIC ONLY ${fixture.url}; fresh disposable storage; no real Kakao provider.\n`);
      for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{fixture.close().then(()=>process.exit(0),()=>process.exit(1));});
    }catch{process.stderr.write('Synthetic staging could not start; no production fallback.\n');process.exitCode=1;}
  }
}
