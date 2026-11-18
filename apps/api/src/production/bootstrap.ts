import {KakaoNativeTokenVerifier,nativeKakaoConfiguration} from '../infrastructure/auth/native-kakao-verifier.js';
import {unlinkOutbox} from './unlink-outbox.js';
import {KakaoUnlinkProvider,kakaoUnlinkConfiguration} from '../infrastructure/auth/kakao-unlink.js';
import {privacyLedgers} from './privacy-ledgers.js';
import {KakaoProvider,kakaoConfiguration} from '../infrastructure/auth/kakao-provider.js';
import 'reflect-metadata';
import {NestFactory} from '@nestjs/core';
import {AppModule} from '../composition/app.module.js';
import {parseEnvironment} from '../config/environment.mjs';
import {staticWeb} from './static-web.js';
export async function bootstrap(environment:NodeJS.ProcessEnv){
 const env=parseEnvironment(environment);
 const web=environment.WEB_ROOT===undefined?undefined:staticWeb(environment.WEB_ROOT,env.dbPath);
 const ledgers=privacyLedgers(environment,env.dbPath);
 const kakao=kakaoConfiguration(environment,env.publicOrigin);
 const nativeKakao=nativeKakaoConfiguration(environment);
 if(nativeKakao&&(!ledgers.deletionLedger||!ledgers.roomDeletionLedger))throw Error('Native authentication authority missing');
 const unlinkKey=kakaoUnlinkConfiguration(environment);
 const unlink=unlinkOutbox(environment,env.dbPath,Boolean(kakao||nativeKakao||unlinkKey));
 const app=await NestFactory.create(AppModule.register({...env,...ledgers,...unlink,nativeKakaoVerifier:nativeKakao?new KakaoNativeTokenVerifier(nativeKakao):undefined,kakaoUnlinkProvider:unlinkKey?new KakaoUnlinkProvider(unlinkKey):undefined,kakaoProvider:kakao?new KakaoProvider(kakao):undefined}),{abortOnError:false,logger:false});
 app.setGlobalPrefix('api');
 if(web)app.use(web);
 app.enableShutdownHooks();
 try{await app.listen(env.port,env.host);return app;}
 catch(error){await app.close();throw error;}
}
