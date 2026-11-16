import type { ServiceStatus } from '../domain/health.js';

export class GetHealth {
  execute(): ServiceStatus { return 'ok'; }
}
