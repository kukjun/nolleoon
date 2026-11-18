import type {LegacyLinksRepository,LegacyLink} from '../../application/ports/legacy-links.js';
import type {SqlAccess} from './account-repository.js';
const columns='id,account_id accountId,run_id runId,legacy_session_id legacySessionId,linked_at linkedAt';
export function legacyLinksRepository({execute,find,all}:SqlAccess):LegacyLinksRepository{return {
 find:(runId,sessionId)=>find<LegacyLink>(`SELECT ${columns} FROM account_legacy_links WHERE run_id=? AND legacy_session_id=?`,runId,sessionId),
 insert:r=>execute('INSERT INTO account_legacy_links VALUES (@id,@accountId,@runId,@legacySessionId,@linkedAt)',r),
 byAccount:(accountId,before,limit)=>before?all<LegacyLink>(`SELECT ${columns} FROM account_legacy_links WHERE account_id=? AND (linked_at<? OR (linked_at=? AND id<?)) ORDER BY linked_at DESC,id DESC LIMIT ?`,accountId,before.linkedAt,before.linkedAt,before.id,limit):all<LegacyLink>(`SELECT ${columns} FROM account_legacy_links WHERE account_id=? ORDER BY linked_at DESC,id DESC LIMIT ?`,accountId,limit),
 findOwned:(id,accountId)=>find<LegacyLink>(`SELECT ${columns} FROM account_legacy_links WHERE id=? AND account_id=?`,id,accountId)
};}
