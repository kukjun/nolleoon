// Isolated test-only identity provider. Never imported by production bootstrap.
import 'reflect-metadata';
import {NestFactory} from '@nestjs/core';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {AppModule} from '../../apps/api/dist/composition/app.module.js';
import {staticWeb} from '../../apps/api/dist/production/static-web.js';
import {watchBrowserLease} from './browser-lease.mjs';
const dir=mkdtempSync(join(tmpdir(),'travel-browser-'));
const origin='http://127.0.0.1:4188',dbPath=join(dir,'synthetic.sqlite');
const kakaoProvider={authorizationUrl:state=>'https://kauth.kakao.com/oauth/authorize?state='+state,exchange:async code=>{const match=/^synthetic-([0-9]+)(?:-[a-zA-Z0-9]+)?$/.exec(code);if(!match)throw Error('Synthetic identity only');return{subject:match[1]};}};
const app=await NestFactory.create(AppModule.register({dbPath,publicOrigin:origin,kakaoProvider}),{logger:false,abortOnError:false});
app.setGlobalPrefix('api');app.use(staticWeb(resolve(import.meta.dirname,'../../apps/web/dist'),dbPath));await app.listen(4188,'127.0.0.1');
let closing=false;
async function close(){if(closing)return;closing=true;await app.close();rmSync(dir,{recursive:true,force:true});process.exit(0);}
watchBrowserLease(process.env.TRIP_BROWSER_LEASE,close,process.env.TRIP_HARNESS_OWNER);process.once('SIGTERM',()=>void close());process.once('SIGINT',()=>void close());
console.log('Synthetic-provider travel HTTP/browser test server ready');
