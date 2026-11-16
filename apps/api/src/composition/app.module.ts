import { Module } from '@nestjs/common';
import { GetHealth } from '../application/get-health.js';
import { HealthController } from '../presentation/health.controller.js';

@Module({ controllers: [HealthController], providers: [{ provide: GetHealth, useFactory: () => new GetHealth() }] })
export class AppModule {}
