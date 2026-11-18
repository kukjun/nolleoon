import {KakaoProvider,kakaoConfiguration} from '../infrastructure/auth/kakao-provider.js';
import 'reflect-metadata';
import {NestFactory} from '@nestjs/core';
import {AppModule} from '../composition/app.module.js';
import {parseEnvironment} from '../config/environment.mjs';
import {staticWeb} from './static-web.js';
export async function bootstrap(environment:NodeJS.ProcessEnv){
 const env=parseEnvironment(environment);
 const web=environment.WEB_ROOT===undefined?undefined:staticWeb(environment.WEB_ROOT,env.dbPath);
 const kakao=kakaoConfiguration(environment,env.publicOrigin);
 const app=await NestFactory.create(AppModule.register({...env,kakaoProvider:kakao?new KakaoProvider(kakao):undefined}),{abortOnError:false,logger:false});
 app.setGlobalPrefix('api');
 if(web)app.use(web);
 app.enableShutdownHooks();
 try{await app.listen(env.port,env.host);return app;}
 catch(error){await app.close();throw error;}
}
