import type {AccountDeletionRepository,RedactedRunSummary} from '../../application/ports/account-deletion.js';
import type {SqlAccess} from './account-repository.js';
import {travelRepository} from './travel-repository.js';
import type Database from 'better-sqlite3';
import {scrubLegacyRuns,legacyNumericProjection} from './legacy-redaction.js';
export function accountDeletionRepository(sql:SqlAccess,db:Database.Database):AccountDeletionRepository {
 const {execute,find,all}=sql,travel=travelRepository(sql);
 return {
 deletion:id=>find<{operationId:string;createdAt:number}>('SELECT operation_id operationId,created_at createdAt FROM account_deletions WHERE account_id=?',id),
 retry:(hash,now)=>find<{accountId:string;operationId:string}>('SELECT d.account_id accountId,d.operation_id operationId FROM account_deletion_receipts r JOIN account_deletions d ON d.operation_id=r.operation_id WHERE r.session_hash=? AND r.expires_at>?',hash,now),
 legacySummary:id=>legacyNumericProjection(db,id)??undefined,
 blocked:id=>!!find("SELECT 1 FROM travel_rooms room JOIN travel_memberships admin ON admin.id=room.administrator_membership_id WHERE admin.account_id=? AND EXISTS(SELECT 1 FROM travel_memberships other WHERE other.room_id=room.id AND other.left_at IS NULL AND other.account_id!=?) LIMIT 1",id,id),
 soloRooms:id=>all<{id:string;version:number;status:'open'|'closed'}>("SELECT room.id,room.version,room.status FROM travel_rooms room JOIN travel_memberships admin ON admin.id=room.administrator_membership_id WHERE admin.account_id=? AND admin.left_at IS NULL AND NOT EXISTS(SELECT 1 FROM travel_memberships other WHERE other.room_id=room.id AND other.left_at IS NULL AND other.account_id!=?) AND NOT EXISTS(SELECT 1 FROM travel_room_deletions d WHERE d.room_id=room.id) ORDER BY room.id",id,id),
 affectedRuns:id=>all<{id:string}>("SELECT DISTINCT run.id FROM travel_runs run WHERE run.id IN (SELECT p.run_id FROM travel_run_participants p JOIN travel_memberships m ON m.id=p.membership_id WHERE m.account_id=?) OR ((run.started_at IS NULL OR run.status='active') AND run.creator_membership_id IN (SELECT id FROM travel_memberships WHERE account_id=?)) OR (run.status='draft' AND EXISTS(SELECT 1 FROM json_each(run.selected_membership_ids_json) selected JOIN travel_memberships m ON m.id=selected.value WHERE m.account_id=?))",id,id,id).map(row=>travel.run(row.id)!),
 linkedRuns:id=>all<{id:string}>('SELECT DISTINCT run_id id FROM account_legacy_links WHERE account_id=? ORDER BY run_id',id).map(r=>r.id),
 legacyProofs:id=>all<{runId:string;sessionId:string}>('SELECT run_id runId,legacy_session_id sessionId FROM account_legacy_links WHERE account_id=? ORDER BY run_id,legacy_session_id',id),
 summary:id=>{const row=find<{json:string}>('SELECT summary_json json FROM travel_run_redactions WHERE run_id=?',id);return row?JSON.parse(row.json) as RedactedRunSummary:undefined;},
 redactRun:(id,summary)=>{
 execute('INSERT OR IGNORE INTO travel_run_redactions VALUES (@id,@summary)',{id,summary:JSON.stringify(summary)});
 execute("UPDATE travel_runs SET settings_json='{}',state_json='{}',result_json=NULL,selected_membership_ids_json='[]',status=CASE WHEN status IN ('draft','active') THEN 'interrupted' ELSE status END,version=version+1 WHERE id=@id AND (settings_json!='{}' OR state_json!='{}' OR result_json IS NOT NULL OR selected_membership_ids_json!='[]' OR status IN ('draft','active'))",{id});
 execute("UPDATE travel_requests SET intent='redacted',result_json='{}' WHERE instr(intent,@id)>0 OR instr(result_json,@id)>0",{id});
 },
 redactLegacy:(entry,allowActiveForRestore=false)=>scrubLegacyRuns(db,entry.legacyRunIds.map(runId=>({runId,departingSessionIds:entry.legacyProofs.filter(p=>p.runId===runId).map(p=>p.sessionId)})),entry.createdAt,{allowActiveForRestore,allowActiveForAccountDeletion:!allowActiveForRestore}),
 scrubIdentity:entry=>{
 execute('INSERT OR IGNORE INTO account_deletions VALUES (@operationId,@accountId,@createdAt)',entry);
 execute('INSERT OR IGNORE INTO account_deletion_receipts SELECT token_hash,@operationId,expires_at FROM account_sessions WHERE account_id=@accountId',{operationId:entry.operationId,accountId:entry.accountId});
 execute('DELETE FROM oauth_attempts WHERE browser_hash IN (SELECT browser_hash FROM account_sessions WHERE account_id=@id) OR previous_session_hash IN (SELECT token_hash FROM account_sessions WHERE account_id=@id)',{id:entry.accountId});
 execute('DELETE FROM provider_identities WHERE account_id=@id',{id:entry.accountId});execute('DELETE FROM account_avatars WHERE account_id=@id',{id:entry.accountId});execute('DELETE FROM account_sessions WHERE account_id=@id',{id:entry.accountId});execute('DELETE FROM account_legacy_links WHERE account_id=@id',{id:entry.accountId});
 execute("UPDATE travel_requests SET intent='redacted',result_json='{}' WHERE account_id=@id",{id:entry.accountId});
 execute('DELETE FROM travel_presence WHERE membership_id IN (SELECT id FROM travel_memberships WHERE account_id=@id)',{id:entry.accountId});
 execute('DELETE FROM travel_run_participants WHERE membership_id IN (SELECT id FROM travel_memberships WHERE account_id=@id)',{id:entry.accountId});
 execute("UPDATE travel_memberships SET left_at=COALESCE(left_at,@now),departure=COALESCE(departure,'left') WHERE account_id=@id",{id:entry.accountId,now:entry.createdAt});
 execute("UPDATE accounts SET status='disabled',display_name='탈퇴한 사용자',preset_id='preset-01',revision=revision+1 WHERE id=@id AND status!='disabled'",{id:entry.accountId});
 }
 };
}
