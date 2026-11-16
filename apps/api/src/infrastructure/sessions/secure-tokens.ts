import type {RandomSource} from '../../application/ports/random.js';
import { randomBytes, randomUUID, createHash, randomInt } from 'node:crypto';
import type { Clock, TokenCodec } from '../../application/browser-sessions.js';
export class SystemClock implements Clock { now() { return Date.now(); } }
export class SecureTokens implements TokenCodec {
  token() { return randomBytes(32).toString('base64url'); }
  id() { return randomUUID(); }
  hash(token: string) { return createHash('sha256').update(token).digest('hex'); }
}

export class SecureRandom implements RandomSource {nextInt(upperExclusive:number){return randomInt(upperExclusive);}}
