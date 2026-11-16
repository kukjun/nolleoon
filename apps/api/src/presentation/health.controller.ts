import { Controller, Get, Inject } from '@nestjs/common';
import type { HealthResponse } from '@trip-court/contracts';
import { GetHealth } from '../application/get-health.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(GetHealth) private readonly getHealth: GetHealth) {}

  @Get()
  get(): HealthResponse {
    return { status: this.getHealth.execute(), service: 'trip-court-api' };
  }
}
