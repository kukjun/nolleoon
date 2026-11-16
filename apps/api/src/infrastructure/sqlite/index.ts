import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { migrations, type Migration } from './migrations.js';
import { StorageError, type UnitOfWork, type Repositories, type RoomRecord, type VoteRecord, type DraftRecord } from '../../application/ports/storage.js';
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
    const repositories:Repositories={
      sessions:{insert:r=>execute('INSERT INTO sessions(id,token_hash,created_at,expires_at) VALUES (@id,@tokenHash,@createdAt,@expiresAt)',r)},
      rooms:{insert:r=>execute('INSERT INTO rooms(id,invite_code,status,version,created_at) VALUES (@id,@inviteCode,@status,@version,@createdAt)',r),find:id=>find<RoomRecord>('SELECT id,invite_code AS inviteCode,status,version,created_at AS createdAt FROM rooms WHERE id=?',id)},
      members:{insert:r=>execute('INSERT INTO room_members(id,room_id,session_id,nickname,nickname_key,joined_at) VALUES (@id,@roomId,@sessionId,@nickname,@nicknameKey,@joinedAt)',r)},
      games:{insert:r=>execute('INSERT INTO games(id,room_id,status,case_text,penalty_text,duration_seconds,version,created_at) VALUES (@id,@roomId,@status,@caseText,@penaltyText,@durationSeconds,@version,@createdAt)',r)},
      participants:{insert:r=>execute('INSERT INTO game_participants(game_id,room_id,member_id,role,eligible) VALUES (@gameId,@roomId,@memberId,@role,@eligible)',{...r,eligible:r.eligible?1:0})},
      rounds:{insert:r=>execute('INSERT INTO rounds(game_id,number,started_at,deadline) VALUES (@gameId,@number,@startedAt,@deadline)',r)},
      votes:{insert:r=>execute('INSERT INTO votes(game_id,round_number,member_id,choice,reason,request_id,submitted_at) VALUES (@gameId,@roundNumber,@memberId,@choice,@reason,@requestId,@submittedAt)',r),find:(g,n,m)=>find<VoteRecord>('SELECT game_id AS gameId,round_number AS roundNumber,member_id AS memberId,choice,reason,request_id AS requestId,submitted_at AS submittedAt FROM votes WHERE game_id=? AND round_number=? AND member_id=?',g,n,m)},
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
