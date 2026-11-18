import type Database from 'better-sqlite3';
/** Schema-15 fragment. No global bypass: exceptions require this exact run's tombstone. */
export const legacyRedactionSql=`
CREATE TABLE legacy_run_redactions(run_id TEXT PRIMARY KEY NOT NULL REFERENCES game_runs(id),redacted_at INTEGER NOT NULL,summary_json TEXT NOT NULL CHECK(json_valid(summary_json))) STRICT;
CREATE TRIGGER legacy_redaction_no_update BEFORE UPDATE ON legacy_run_redactions BEGIN SELECT RAISE(ABORT,'immutable redaction'); END;
CREATE TRIGGER legacy_redaction_no_delete BEFORE DELETE ON legacy_run_redactions BEGIN SELECT RAISE(ABORT,'immutable redaction'); END;
DROP TRIGGER run_settings_immutable;
CREATE TRIGGER run_settings_immutable BEFORE UPDATE OF id,room_id,type,settings_json,created_at ON game_runs WHEN NOT (
 NEW.id=OLD.id AND NEW.room_id=OLD.room_id AND NEW.type=OLD.type AND NEW.created_at=OLD.created_at
 AND EXISTS(SELECT 1 FROM legacy_run_redactions WHERE run_id=OLD.id)
 AND NEW.settings_json=json_remove(OLD.settings_json,'$.penaltyText')) BEGIN SELECT RAISE(ABORT,'immutable run'); END;
DROP TRIGGER run_participants_immutable;
CREATE TRIGGER run_participants_immutable BEFORE UPDATE ON run_participants WHEN NOT (
 NEW.run_id=OLD.run_id AND NEW.room_id=OLD.room_id AND NEW.member_id=OLD.member_id AND NEW.eligible=OLD.eligible AND NEW.nickname=''
 AND EXISTS(SELECT 1 FROM legacy_run_redactions WHERE run_id=OLD.run_id)) BEGIN SELECT RAISE(ABORT,'immutable participant'); END;
DROP TRIGGER run_allocations_no_delete;
CREATE TRIGGER run_allocations_no_delete BEFORE DELETE ON run_allocations WHEN NOT EXISTS(SELECT 1 FROM legacy_run_redactions WHERE run_id=OLD.run_id) BEGIN SELECT RAISE(ABORT,'immutable allocation'); END;
DROP TRIGGER run_reveals_no_delete;
CREATE TRIGGER run_reveals_no_delete BEFORE DELETE ON run_reveals WHEN NOT EXISTS(SELECT 1 FROM legacy_run_redactions WHERE run_id=OLD.run_id) BEGIN SELECT RAISE(ABORT,'immutable reveal'); END;
DROP TRIGGER party_receipts_no_delete;
CREATE TRIGGER party_receipts_no_delete BEFORE DELETE ON party_receipts WHEN NOT EXISTS(SELECT 1 FROM legacy_run_redactions WHERE run_id=OLD.run_id) BEGIN SELECT RAISE(ABORT,'immutable receipt'); END;
DROP TRIGGER next_preparation_no_delete;
CREATE TRIGGER next_preparation_no_delete BEFORE DELETE ON next_preparation_receipts WHEN NOT EXISTS(SELECT 1 FROM legacy_run_redactions WHERE run_id=OLD.from_game_id) BEGIN SELECT RAISE(ABORT,'immutable preparation receipt'); END;
`;
export interface LegacyNumericSummary {participantCount:number;teams:{team:number;count:number}[];revealed:{winnerCount:number;notWinnerCount:number};rounds:{number:number;guilty:number;notGuilty:number;abstain:number;total:number}[]}
/** Trusted explicit run IDs only: caller derives these from account links or verified deletion ledger.
 * Must share the account-deletion transaction. Never derive targets from anonymous session history. */
export function scrubLegacyRuns(db:Database.Database,targets:readonly {runId:string;departingSessionIds:readonly string[]}[],now:number,options:{allowActiveForRestore?:boolean;allowActiveForAccountDeletion?:boolean}={}):void{
 if(!db.inTransaction)throw new Error('Legacy redaction requires transaction');
 for(const target of targets){
  const id=target.runId;
  const run=db.prepare('SELECT id,room_id roomId,type,status FROM game_runs WHERE id=?').get(id) as {id:string;roomId:string;type:'trial'|'team'|'draw';status:string}|undefined;
  if(!run)continue;
  if(run.status==='active'){
   if(!options.allowActiveForRestore&&!options.allowActiveForAccountDeletion)throw new Error('Linked active legacy run cannot be redacted');
   // Explicit live account deletion or authoritative replay stops this exact linked run.
   // Close without settlement: unpublished votes/lots must never become public results.
   db.prepare("UPDATE rounds SET closed_at=? WHERE game_id=? AND closed_at IS NULL").run(now,id);
   if(run.type==='trial'){
    db.prepare("INSERT OR IGNORE INTO game_interruptions VALUES (?,'legacy-private',?)").run(id,now);
    db.prepare("UPDATE games SET status='interrupted',version=version+1 WHERE id=?").run(id);
   }else db.prepare("UPDATE game_runs SET status='interrupted',version=version+1 WHERE id=?").run(id);
   run.status='interrupted';
  }
  const existing=db.prepare('SELECT run_id FROM legacy_run_redactions WHERE run_id=?').get(id);
  if(!existing){
   const count=db.prepare('SELECT COUNT(*) n FROM run_participants WHERE run_id=?').get(id) as {n:number};
   const teams=db.prepare('SELECT team,COUNT(*) count FROM run_allocations WHERE run_id=? AND team IS NOT NULL GROUP BY team ORDER BY team').all(id) as {team:number;count:number}[];
   const revealed=db.prepare('SELECT COALESCE(SUM(a.winning=1),0) winnerCount,COALESCE(SUM(a.winning=0),0) notWinnerCount FROM run_allocations a JOIN run_reveals r ON r.run_id=a.run_id AND r.member_id=a.member_id WHERE a.run_id=?').get(id) as LegacyNumericSummary['revealed'];
   const rounds=db.prepare('SELECT round_number number,guilty,not_guilty notGuilty,abstain,total FROM round_settlements WHERE game_id=? ORDER BY round_number').all(id) as LegacyNumericSummary['rounds'];
   const summary:LegacyNumericSummary={participantCount:count.n,teams,revealed,rounds};
   db.prepare('INSERT INTO legacy_run_redactions VALUES(?,?,?)').run(id,now,JSON.stringify(summary));
  }
  // Room-level editing buffers are scrubbed only if receipt version proves they are this run's copy.
  db.prepare(`UPDATE drafts SET case_text='',penalty_text='' WHERE room_id=? AND EXISTS(SELECT 1 FROM start_receipts s WHERE s.game_id=? AND s.room_id=drafts.room_id AND json_valid(s.intent) AND json_extract(s.intent,'$[0]')=drafts.version) AND NOT EXISTS(SELECT 1 FROM games g WHERE g.room_id=drafts.room_id AND g.rowid>(SELECT rowid FROM games WHERE id=?))`).run(run.roomId,id,id);
  db.prepare(`UPDATE party_selections SET penalty_text='' WHERE room_id=? AND EXISTS(SELECT 1 FROM party_receipts p WHERE p.run_id=? AND p.action='start' AND json_valid(p.intent) AND json_extract(p.intent,'$[0]')=party_selections.version) AND NOT EXISTS(SELECT 1 FROM game_runs g WHERE g.room_id=party_selections.room_id AND g.rowid>(SELECT rowid FROM game_runs WHERE id=?))`).run(run.roomId,id,id);
  db.prepare("UPDATE games SET case_text='',penalty_text='' WHERE id=?").run(id);
  db.prepare("UPDATE game_runs SET settings_json=json_remove(settings_json,'$.penaltyText') WHERE id=?").run(id);
  for(const [table,column] of [['votes','game_id'],['defenses','game_id'],['vote_open_receipts','game_id'],['start_receipts','game_id'],['next_preparation_receipts','from_game_id'],['party_receipts','run_id'],['run_reveals','run_id'],['run_allocations','run_id']])db.prepare(`DELETE FROM ${table} WHERE ${column}=?`).run(id);
  db.prepare("UPDATE run_participants SET nickname='' WHERE run_id=?").run(id);
  for(const sessionId of new Set(target.departingSessionIds)){
   db.prepare('DELETE FROM run_participants WHERE run_id=? AND member_id IN (SELECT id FROM room_members WHERE session_id=?)').run(id,sessionId);
   db.prepare('DELETE FROM game_participants WHERE game_id=? AND member_id IN (SELECT id FROM room_members WHERE session_id=?)').run(id,sessionId);
  }
 }
}
export function legacyNumericProjection(db:Database.Database,runId:string):LegacyNumericSummary|null{const row=db.prepare('SELECT summary_json json FROM legacy_run_redactions WHERE run_id=?').get(runId) as {json:string}|undefined;return row?JSON.parse(row.json) as LegacyNumericSummary:null;}
