import { randomBytes, randomUUID, createHash } from 'node:crypto';
import type { Clock, TokenCodec } from '../../application/browser-sessions.js';
export class SystemClock implements Clock { now() { return Date.now(); } }
export class SecureTokens implements TokenCodec {
  token() { return randomBytes(32).toString('base64url'); }
  id() { return randomUUID(); }
  hash(token: string) { return createHash('sha256').update(token).digest('hex'); }
}
