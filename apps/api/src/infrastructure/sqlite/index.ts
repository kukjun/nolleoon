import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { migrations, type Migration } from './migrations.js';
import { StorageError, type AvatarRecord, type UnitOfWork, type NextReceipt, type InterruptionRecord, type ClosureRecord, type Repositories, type SettlementRecord, type RoomRecord, type MemberRecord, type ConsentRecord, type GameRecord, type ParticipantRecord, type StartReceipt, type DefenseRecord, type OpenReceipt, type RoundRecord, type VoteRecord, type DraftRecord, type SessionRecord } from '../../application/ports/storage.js';
export { StorageError } from '../../application/ports/storage.js';

export function openSqlite(path: string, options: {busyTimeoutMs?: number} = {}): Database.Database {
  if (!isAbsolute(path)) throw new Error('DB 절대 경로가 필요합니다. 공개 디렉터리 밖 경로 선택은 호출자의 책임입니다.');
  const timeout=options.busyTimeoutMs??1000;
  if(!Number.isInteger(timeout)||timeout<0||timeout>30000) throw new Error('busy timeout은 0~30000ms 정수여야 합니다.');
  const db=new Database(path,{timeout});
  try {
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    db.pragma(`busy_timeout = ${timeout}`);
    return db;
  } catch(error) { db.close(); throw error; }
}
export function migrate(db: Database.Database, upgrades: readonly Migration[] = migrations): void {
  if (!upgrades.length || upgrades.some((m,i)=>m.version!==i+1)) throw new Error('마이그레이션 정의는 1부터 순차 제공해야 합니다.');
  db.transaction(()=>{
    db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL) STRICT');
    const applied=db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as {version:number}[];
    if(applied.some((row,i)=>row.version!==i+1 || !upgrades.some(m=>m.version===row.version))) throw new Error('지원하지 않는 DB 스키마 또는 누락된 마이그레이션 정의입니다.');
    const seen=new Set<number>();
    for(const migration of upgrades) {
      if(!Number.isSafeInteger(migration.version)||migration.version<1||seen.has(migration.version)) throw new Error('마이그레이션 버전 오류');
      seen.add(migration.version);
      const checksum=createHash('sha256').update(migration.sql).digest('hex');
      const existing=db.prepare('SELECT name,checksum FROM schema_migrations WHERE version=?').get(migration.version) as {name:string;checksum:string}|undefined;
      if(existing) {
        if(existing.name!==migration.name||existing.checksum!==checksum) throw new Error('적용된 마이그레이션 변경 감지');
        continue;
      }
      const latest=db.prepare('SELECT COALESCE(MAX(version),0) AS version FROM schema_migrations').get() as {version:number};
      if(migration.version!==latest.version+1) throw new Error('마이그레이션은 순차 적용해야 합니다.');
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations(version,name,checksum) VALUES (?,?,?)').run(migration.version,migration.name,checksum);
    }
  }).immediate();
}
function translate(error: unknown): never {
  const code=error instanceof Error && 'code' in error ? String(error.code) : '';
  if(code.startsWith('SQLITE_BUSY')||code.startsWith('SQLITE_LOCKED')) throw new StorageError('busy','저장소가 사용 중입니다. 동일 명령의 안전한 재시도 정책을 확인하세요.');
  if(code.startsWith('SQLITE_CONSTRAINT')) throw new StorageError('constraint','저장소 무결성 조건을 위반했습니다.');
  if(code.startsWith('SQLITE_')) throw new StorageError('storage','저장소 처리에 실패했습니다.');
  throw error;
}
export class SqliteUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Database.Database) {}
  run<T>(work: (repositories: Repositories)=>T): T {
    let active=true;
    const execute=(sql:string,params:object)=>{if(!active)throw new Error('종료된 트랜잭션 저장소입니다.');this.db.prepare(sql).run(params);};
    const find=<TRecord>(sql:string,...params:(string|number)[]):TRecord|undefined=>{if(!active)throw new Error('종료된 트랜잭션 저장소입니다.');return this.db.prepare(sql).get(...params) as TRecord|undefined;};
    const all=<TRecord>(sql:string,...params:(string|number)[]):TRecord[]=>{if(!active)throw new Error('종료된 트랜잭션 저장소입니다.');return this.db.prepare(sql).all(...params) as TRecord[];};
    const gameColumns='id,room_id AS roomId,status,case_text AS caseText,penalty_text AS penaltyText,duration_seconds AS durationSeconds,version,created_at AS createdAt';
    const repositories:Repositories={
      avatars:{find:id=>find<AvatarRecord>('SELECT session_id AS sessionId,preset_id AS presetId,revision,image_bytes AS imageBytes FROM avatar_profiles WHERE session_id=?',id),save:r=>execute('INSERT INTO avatar_profiles(session_id,preset_id,revision,image_bytes) VALUES (@sessionId,@presetId,@revision,@imageBytes) ON CONFLICT(session_id) DO UPDATE SET preset_id=excluded.preset_id,revision=excluded.revision,image_bytes=excluded.image_bytes',r)},
      nextPreparations:{find:(roomId,requestId)=>find<NextReceipt>('SELECT room_id AS roomId,request_id AS requestId,actor_session_id AS actorSessionId,from_game_id AS fromGameId,expected_preparation_version AS expectedPreparationVersion,preparation_version AS preparationVersion FROM next_preparation_receipts WHERE room_id=? AND request_id=?',roomId,requestId),insert:r=>execute('INSERT INTO next_preparation_receipts VALUES (@roomId,@requestId,@actorSessionId,@fromGameId,@expectedPreparationVersion,@preparationVersion)',r)},
      interruptions:{find:id=>find<InterruptionRecord>('SELECT game_id AS gameId,cause,interrupted_at AS interruptedAt FROM game_interruptions WHERE game_id=?',id),insert:r=>execute('INSERT INTO game_interruptions(game_id,cause,interrupted_at) VALUES (@gameId,@cause,@interruptedAt)',r)},
      closures:{find:id=>find<ClosureRecord>('SELECT room_id AS roomId,closed_at AS closedAt,closed_by_member_id AS closedByMemberId FROM room_closures WHERE room_id=?',id),insert:r=>execute('INSERT INTO room_closures(room_id,closed_at,closed_by_member_id) VALUES (@roomId,@closedAt,@closedByMemberId)',r)},
      defenses:{find:(gameId,number)=>find<DefenseRecord>('SELECT game_id AS gameId,round_number AS roundNumber,member_id AS memberId,action,text FROM defenses WHERE game_id=? AND round_number=?',gameId,number),save:r=>execute('INSERT INTO defenses(game_id,round_number,member_id,action,text) VALUES (@gameId,@roundNumber,@memberId,@action,@text) ON CONFLICT(game_id,round_number) DO UPDATE SET member_id=excluded.member_id,action=excluded.action,text=excluded.text',r)},
      opens:{find:(gameId,requestId)=>find<OpenReceipt>('SELECT game_id AS gameId,request_id AS requestId,actor_session_id AS actorSessionId,intent,round_number AS roundNumber FROM vote_open_receipts WHERE game_id=? AND request_id=?',gameId,requestId),insert:r=>execute('INSERT INTO vote_open_receipts(game_id,request_id,actor_session_id,intent,round_number) VALUES (@gameId,@requestId,@actorSessionId,@intent,@roundNumber)',r)},
      starts:{find:(roomId,requestId)=>find<StartReceipt>('SELECT room_id AS roomId,request_id AS requestId,actor_session_id AS actorSessionId,intent,game_id AS gameId FROM start_receipts WHERE room_id=? AND request_id=?',roomId,requestId),insert:r=>execute('INSERT INTO start_receipts(room_id,request_id,actor_session_id,intent,game_id) VALUES (@roomId,@requestId,@actorSessionId,@intent,@gameId)',r)},
      consents:{find:roomId=>find<ConsentRecord>('SELECT room_id AS roomId,member_id AS memberId,role_revision AS roleRevision,penalty_revision AS penaltyRevision,decision,version FROM penalty_consents WHERE room_id=?',roomId),save:r=>execute('INSERT INTO penalty_consents(room_id,member_id,role_revision,penalty_revision,decision,version) VALUES (@roomId,@memberId,@roleRevision,@penaltyRevision,@decision,@version) ON CONFLICT(room_id) DO UPDATE SET member_id=excluded.member_id,role_revision=excluded.role_revision,penalty_revision=excluded.penalty_revision,decision=excluded.decision,version=excluded.version',r)},
      sessions:{insert:r=>execute('INSERT INTO sessions(id,token_hash,created_at,expires_at) VALUES (@id,@tokenHash,@createdAt,@expiresAt)',r),findByTokenHash:hash=>find<SessionRecord>('SELECT id,token_hash AS tokenHash,created_at AS createdAt,expires_at AS expiresAt FROM sessions WHERE token_hash=?',hash),extendExpiry:(id,expiresAt)=>execute('UPDATE sessions SET expires_at=@expiresAt WHERE id=@id',{id,expiresAt})},
      rooms:{prepareNext:(id,fromGameId)=>execute('UPDATE rooms SET preparation_version=preparation_version+1,prepared_after_game_id=@fromGameId WHERE id=@id',{id,fromGameId}),close:id=>execute("UPDATE rooms SET status='closed',host_member_id=NULL WHERE id=@id",{id}),open:()=>all<RoomRecord>("SELECT id,invite_code AS inviteCode,status,version,created_at AS createdAt,host_member_id AS hostMemberId,role_revision AS roleRevision,penalty_revision AS penaltyRevision,preparation_version AS preparationVersion,prepared_after_game_id AS preparedAfterGameId FROM rooms WHERE status='open'"),insert:r=>execute('INSERT INTO rooms(id,invite_code,status,version,created_at) VALUES (@id,@inviteCode,@status,@version,@createdAt)',r),find:id=>find<RoomRecord>('SELECT id,invite_code AS inviteCode,status,version,created_at AS createdAt,host_member_id AS hostMemberId,role_revision AS roleRevision,penalty_revision AS penaltyRevision,preparation_version AS preparationVersion,prepared_after_game_id AS preparedAfterGameId FROM rooms WHERE id=?',id),findByInvite:code=>find<RoomRecord>('SELECT id,invite_code AS inviteCode,status,version,created_at AS createdAt,host_member_id AS hostMemberId,role_revision AS roleRevision,penalty_revision AS penaltyRevision,preparation_version AS preparationVersion,prepared_after_game_id AS preparedAfterGameId FROM rooms WHERE invite_code=?',code),setHost:(id,memberId)=>execute('UPDATE rooms SET host_member_id=@memberId WHERE id=@id',{id,memberId}),bumpVersion:id=>execute('UPDATE rooms SET version=version+1 WHERE id=@id',{id}),bumpRoleRevision:id=>execute('UPDATE rooms SET role_revision=role_revision+1 WHERE id=@id',{id}),bumpPenaltyRevision:id=>execute('UPDATE rooms SET penalty_revision=penalty_revision+1 WHERE id=@id',{id})},
      members:{find:id=>find<MemberRecord & {leftAt:number|null}>('SELECT id,room_id AS roomId,session_id AS sessionId,nickname,nickname_key AS nicknameKey,joined_at AS joinedAt,last_seen_at AS lastSeenAt,disconnected_at AS disconnectedAt,role,left_at AS leftAt FROM room_members WHERE id=?',id),idsForSession:(roomId,sessionId)=>all<{id:string}>('SELECT id FROM room_members WHERE room_id=? AND session_id=?',roomId,sessionId).map(m=>m.id),insert:r=>execute('INSERT INTO room_members(id,room_id,session_id,nickname,nickname_key,joined_at,last_seen_at) VALUES (@id,@roomId,@sessionId,@nickname,@nicknameKey,@joinedAt,@joinedAt)',r),active:roomId=>all<MemberRecord>('SELECT id,room_id AS roomId,session_id AS sessionId,nickname,nickname_key AS nicknameKey,joined_at AS joinedAt,last_seen_at AS lastSeenAt,disconnected_at AS disconnectedAt,role FROM room_members WHERE room_id=? AND left_at IS NULL ORDER BY joined_at,id',roomId),setRole:(id,role)=>execute('UPDATE room_members SET role=@role WHERE id=@id AND left_at IS NULL',{id,role}),exclude:(id,now)=>execute('UPDATE room_members SET left_at=@now WHERE id=@id AND left_at IS NULL',{id,now}),touch:(id,now)=>execute('UPDATE room_members SET last_seen_at=@now,disconnected_at=NULL WHERE id=@id AND left_at IS NULL',{id,now}),detectDisconnected:(now,silentMs)=>{const ids=all<{roomId:string}>('SELECT DISTINCT room_id AS roomId FROM room_members WHERE left_at IS NULL AND disconnected_at IS NULL AND last_seen_at<=? AND room_id IN (SELECT id FROM rooms WHERE status=\'open\')',now-silentMs);execute("UPDATE room_members SET disconnected_at=@now WHERE left_at IS NULL AND disconnected_at IS NULL AND last_seen_at<=@threshold AND room_id IN (SELECT id FROM rooms WHERE status='open')",{now,threshold:now-silentMs});return ids.map(r=>r.roomId);}},
      games:{history:(sessionId,before,limit)=>all<GameRecord>(`SELECT ${gameColumns} FROM games WHERE EXISTS (SELECT 1 FROM game_participants p JOIN room_members m ON m.id=p.member_id WHERE p.game_id=games.id AND m.session_id=?) ${before?'AND (created_at<? OR (created_at=? AND id<?))':''} ORDER BY created_at DESC,id DESC LIMIT ?`,sessionId,...(before?[before.createdAt,before.createdAt,before.id]:[]),limit),update:r=>execute('UPDATE games SET status=@status,duration_seconds=@durationSeconds,version=@version WHERE id=@id',r),insert:r=>execute('INSERT INTO games(id,room_id,status,case_text,penalty_text,duration_seconds,version,created_at) VALUES (@id,@roomId,@status,@caseText,@penaltyText,@durationSeconds,@version,@createdAt)',r),hasActive:roomId=>Boolean(find<{id:string}>("SELECT id FROM games WHERE room_id=? AND status NOT IN ('result','interrupted') LIMIT 1",roomId)),active:roomId=>find<GameRecord>(`SELECT ${gameColumns} FROM games WHERE room_id=? AND status NOT IN ('result','interrupted') LIMIT 1`,roomId),latest:roomId=>find<GameRecord>(`SELECT ${gameColumns} FROM games WHERE room_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1`,roomId),find:id=>find<GameRecord>(`SELECT ${gameColumns} FROM games WHERE id=?`,id)},
      participants:{hasSession:(gameId,sessionId)=>Boolean(find<{yes:number}>('SELECT 1 AS yes FROM game_participants p JOIN room_members m ON m.id=p.member_id WHERE p.game_id=? AND m.session_id=? LIMIT 1',gameId,sessionId)),insert:r=>execute('INSERT INTO game_participants(game_id,room_id,member_id,role,eligible) VALUES (@gameId,@roomId,@memberId,@role,@eligible)',{...r,eligible:r.eligible?1:0}),list:gameId=>all<ParticipantRecord>('SELECT game_id AS gameId,room_id AS roomId,member_id AS memberId,role,eligible FROM game_participants WHERE game_id=?',gameId).map(p=>({...p,eligible:Boolean(p.eligible)}))},
      rounds:{pending:()=>all<RoundRecord>("SELECT r.game_id AS gameId,r.number,r.started_at AS startedAt,r.deadline,r.closed_at AS closedAt FROM rounds r JOIN games g ON g.id=r.game_id WHERE r.closed_at IS NULL AND g.status='voting'"),close:(g,n,now)=>execute('UPDATE rounds SET closed_at=@now WHERE game_id=@gameId AND number=@number AND closed_at IS NULL',{now,gameId:g,number:n}),find:(gameId,number)=>find<RoundRecord>('SELECT game_id AS gameId,number,started_at AS startedAt,deadline,closed_at AS closedAt FROM rounds WHERE game_id=? AND number=?',gameId,number),insert:r=>execute('INSERT INTO rounds(game_id,number,started_at,deadline) VALUES (@gameId,@number,@startedAt,@deadline)',r)},
      settlements:{insert:r=>execute('INSERT INTO round_settlements(game_id,round_number,outcome,guilty,not_guilty,abstain,total,closed_at,closed_by) VALUES (@gameId,@roundNumber,@outcome,@guilty,@notGuilty,@abstain,@total,@closedAt,@closedBy)',r),find:(g,n)=>find<SettlementRecord>('SELECT game_id AS gameId,round_number AS roundNumber,outcome,guilty,not_guilty AS notGuilty,abstain,total,closed_at AS closedAt,closed_by AS closedBy FROM round_settlements WHERE game_id=? AND round_number=?',g,n)},
      votes:{list:(g,n)=>all<VoteRecord>('SELECT game_id AS gameId,round_number AS roundNumber,member_id AS memberId,choice,reason,request_id AS requestId,submitted_at AS submittedAt FROM votes WHERE game_id=? AND round_number=?',g,n),insert:r=>execute('INSERT INTO votes(game_id,round_number,member_id,choice,reason,request_id,submitted_at) VALUES (@gameId,@roundNumber,@memberId,@choice,@reason,@requestId,@submittedAt)',r),find:(g,n,m)=>find<VoteRecord>('SELECT game_id AS gameId,round_number AS roundNumber,member_id AS memberId,choice,reason,request_id AS requestId,submitted_at AS submittedAt FROM votes WHERE game_id=? AND round_number=? AND member_id=?',g,n,m)},
      drafts:{save:r=>execute('INSERT INTO drafts(room_id,case_text,penalty_text,duration_seconds,version) VALUES (@roomId,@caseText,@penaltyText,@durationSeconds,@version) ON CONFLICT(room_id) DO UPDATE SET case_text=excluded.case_text,penalty_text=excluded.penalty_text,duration_seconds=excluded.duration_seconds,version=excluded.version',r),find:id=>find<DraftRecord>('SELECT room_id AS roomId,case_text AS caseText,penalty_text AS penaltyText,duration_seconds AS durationSeconds,version FROM drafts WHERE room_id=?',id)}
    };
    try {
      return this.db.transaction(()=>{
        const result=work(repositories);
        if(result && typeof (result as {then?:unknown}).then==='function') {
          void Promise.resolve(result).catch(()=>undefined);
          throw new Error('UnitOfWork는 동기 콜백만 허용합니다.');
        }
        return result;
      }).immediate();
    } catch(error) {return translate(error);} finally {active=false;}
  }
}

export { migrations } from "./migrations.js";
