import type {NativeAccountSessions,NativeAccountSession} from '../../application/ports/native-account-sessions.js';
import type {SqlAccess} from './account-repository.js';
export function nativeSessionRepository({execute,find}:SqlAccess):NativeAccountSessions{return {
 find:hash=>find<NativeAccountSession>('SELECT token_hash tokenHash,account_id accountId,created_at createdAt,expires_at expiresAt,revoked_at revokedAt FROM native_account_sessions WHERE token_hash=?',hash),
 insert:r=>execute('INSERT INTO native_account_sessions VALUES (@tokenHash,@accountId,@createdAt,@expiresAt,@revokedAt)',r),
 revoke:(hash,now)=>execute('UPDATE native_account_sessions SET revoked_at=@now WHERE token_hash=@hash AND revoked_at IS NULL',{hash,now})
};}
