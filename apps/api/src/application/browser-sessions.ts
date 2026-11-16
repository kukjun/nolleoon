import type { UnitOfWork } from './ports/storage.js';
export interface Clock { now(): number }
export interface TokenCodec { token(): string; id(): string; hash(token: string): string }
export const SESSION_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;
export class SessionRequired extends Error { constructor() { super('유효한 브라우저 세션이 필요합니다.'); } }
export class BrowserSessions {
  constructor(private readonly uow: UnitOfWork, private readonly clock: Clock, private readonly codec: TokenCodec) {}
  require(token?: string): {id: string} {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new SessionRequired();
    return this.uow.run(r=>{
      const record=r.sessions.findByTokenHash(this.codec.hash(token));
      if(!record || record.expiresAt<=this.clock.now()) throw new SessionRequired();
      return {id:record.id};
    });
  }
  // token은 쿠키 어댑터에만 전달하며 JSON DTO로 직렬화하지 않는다.
  open(token?: string): {token: string; expiresAt: number} {
    return this.uow.run(r=>{
      const now=this.clock.now();
      const existing=token && /^[A-Za-z0-9_-]{43}$/.test(token) ? r.sessions.findByTokenHash(this.codec.hash(token)) : undefined;
      if(existing && existing.expiresAt>now) {
        r.sessions.extendExpiry(existing.id,now+SESSION_LIFETIME_MS);
        return {token:token!,expiresAt:now+SESSION_LIFETIME_MS};
      }
      const fresh=this.codec.token();
      r.sessions.insert({id:this.codec.id(),tokenHash:this.codec.hash(fresh),createdAt:now,expiresAt:now+SESSION_LIFETIME_MS});
      return {token:fresh,expiresAt:now+SESSION_LIFETIME_MS};
    });
  }
}
