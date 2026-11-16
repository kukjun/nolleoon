import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './composition/app.module.js';
import { parseEnvironment } from './config/environment.mjs';

async function bootstrap() {
  const env = parseEnvironment(process.env);
  const app = await NestFactory.create(AppModule.register(env),{abortOnError:false});
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  try { await app.listen(env.port, env.host); }
  catch(error) { await app.close(); throw error; }
}
bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'API 시작에 실패했습니다.');
  process.exitCode = 1;
});
