import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/dist/composition/app.module.js';
test('실제 Nest 조립과 HTTP BFF 계약', async () => {
 const app=await NestFactory.create(AppModule,{logger:false});
 try {
  app.setGlobalPrefix('api'); await app.listen(0,'127.0.0.1');
  const url=await app.getUrl(); const response=await fetch(`${url}/api/health`,{signal:AbortSignal.timeout(3000)});
  assert.equal(response.status,200); assert.deepEqual(await response.json(),{status:'ok',service:'trip-court-api'});
  assert.equal((await fetch(`${url}/api/missing`,{signal:AbortSignal.timeout(3000)})).status,404);
 } finally { await app.close(); }
});
