import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { lstat, realpath, mkdtemp, rm, link, open } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { migrate } from './index.js';
import { migrations } from './migrations.js';

const failure = 'BACKUP_FAILED: 백업 또는 복원 검증에 실패했습니다. 원본과 기존 대상은 덮어쓰지 않았습니다.';

/** Read-only validation: never run migrations on an input backup. */
function validate(db: Database.Database): void {
  const integrity = db.pragma('integrity_check') as { integrity_check: string }[];
  if (integrity.length !== 1 || integrity[0]?.integrity_check !== 'ok') throw new Error('integrity');
  if ((db.pragma('foreign_key_check') as unknown[]).length !== 0) throw new Error('foreign keys');
  const rows = db.prepare('SELECT version,name,checksum FROM schema_migrations ORDER BY version').all() as {version:number;name:string;checksum:string}[];
  // Explicit deployed restore sources: pre-party schema9 and party schema11. Never migrate input.
  if (rows.length !== 9 && rows.length !== 11 && rows.length !== migrations.length) throw new Error('manifest length');
  const expected = migrations.slice(0, rows.length);
  const reference = new Database(':memory:');
  try {
    migrate(reference, expected);
    const schema = "SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name";
    if (JSON.stringify(db.prepare(schema).all()) !== JSON.stringify(reference.prepare(schema).all())) throw new Error('schema mismatch');
  } finally { reference.close(); }
  for (const [index, migration] of expected.entries()) {
    const row = rows[index];
    const checksum = createHash('sha256').update(migration.sql).digest('hex');
    if (!row || row.version !== migration.version || row.name !== migration.name || row.checksum !== checksum) throw new Error('manifest mismatch');
  }
}

/** An online SQLite snapshot, verified then published atomically without replacement. */
export async function backupDatabase(source: string, destination: string): Promise<void> {
  let temporary: string | undefined;
  let reader: Database.Database | undefined;
  let published = false;
  let problem: Error | undefined;
  try {
    if (!isAbsolute(source) || !isAbsolute(destination)) throw new Error('absolute paths required');
    if (!(await lstat(source)).isFile()) throw new Error('regular source required');
    const sourcePath = await realpath(source);
    const parent = await realpath(dirname(destination));
    const target = join(parent, basename(destination));
    if (sourcePath === target || target.trim() !== target) throw new Error('invalid target');
    // lstat also refuses existing dangling symlinks. link below closes the publication race.
    try { await lstat(target); throw new Error('destination exists'); }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
    temporary = await mkdtemp(join(parent, '.trip-backup-'));
    const snapshot = join(temporary, 'snapshot.sqlite');
    reader = new Database(sourcePath, { readonly: true, fileMustExist: true, timeout: 1000 });
    validate(reader);
    await reader.backup(snapshot);
    reader.close(); reader = undefined;
    const verifier = new Database(snapshot, { readonly: true, fileMustExist: true });
    try { validate(verifier); } finally { verifier.close(); }
    const file = await open(snapshot, 'r');
    try { await file.sync(); } finally { await file.close(); }
    // Same-filesystem hard link is an atomic no-clobber publish, unlike rename().
    await link(snapshot, target);
    published = true;
  } catch {
    problem = new Error(failure);
  } finally {
    try {
      if (reader?.open) reader.close();
      if (temporary) await rm(temporary, { recursive: true, force: true });
    } catch {
      problem = new Error(published
        ? 'BACKUP_CLEANUP_FAILED: 새 대상은 게시됐으나 임시 파일 정리에 실패했습니다. 대상을 검증하고 임시 파일을 점검하세요.'
        : failure);
    }
  }
  if (problem) throw problem;
}

/** Restore is deliberately a verified snapshot to a NEW path, never an overwrite. */
export async function restoreDatabase(source: string, destination: string): Promise<void> {
  await backupDatabase(source, destination);
}
