import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppModule } from '../../apps/api/dist/composition/app.module.js';
export async function apiFixture(options={}) {
 const directory=mkdtempSync(join(tmpdir(),'trip-court-api-'));
 const dbPath=join(directory,'test.sqlite'); const publicOrigin=options.publicOrigin??'https://trip.example';
 let app;
 try {
  app=await NestFactory.create(AppModule.register({dbPath,publicOrigin,clock:options.clock}),{logger:false,abortOnError:false});
  app.setGlobalPrefix('api');if(options.staticRoot)app.useStaticAssets(options.staticRoot);await app.listen(options.port??0,'127.0.0.1');
  return {app,dbPath,publicOrigin,url:await app.getUrl(),close:async()=>{await app.close();rmSync(directory,{recursive:true,force:true});}};
 } catch(error){await app?.close();rmSync(directory,{recursive:true,force:true});throw error;}
}
