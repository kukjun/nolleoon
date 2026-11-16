import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, readdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { openSqlite, migrate } from '../../apps/api/dist/infrastructure/sqlite/index.js';
import { backupDatabase, restoreDatabase } from '../../apps/api/dist/infrastructure/sqlite/backup.js';
async function fixture(t) {
 const root=await mkdtemp(join(tmpdir(),'trip-backup-')); t.after(()=>rm(root,{recursive:true,force:true}));
 const source=join(root,'source.sqlite'); const db=openSqlite(source); migrate(db); t.after(()=>{if(db.open)db.close();});
 db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run('s','synthetic',1,1000);
 return {root,source,db,dest:join(root,'backup.sqlite')};
}
test('온라인 WAL 백업은 열린 writer의 최신 커밋과 rollback 경계를 보존하고 새 경로로 복원한다',async t=>{
 const {root,source,db,dest}=await fixture(t);
 db.prepare('UPDATE sessions SET expires_at=2000').run();
 db.exec('BEGIN IMMEDIATE');db.prepare('UPDATE sessions SET expires_at=3000').run();
 const before=await readFile(source);
 await backupDatabase(source,dest);
 assert.deepEqual(await readFile(source),before);
 const copy=new Database(dest,{readonly:true});assert.equal(copy.prepare('SELECT expires_at FROM sessions').get().expires_at,2000);copy.close();
 db.exec('ROLLBACK');
 const restored=join(root,'restored.sqlite');await restoreDatabase(dest,restored);
 const result=new Database(restored,{readonly:true});assert.equal(result.prepare('SELECT expires_at FROM sessions').get().expires_at,2000);result.close();
 assert.equal((await readdir(root)).some(n=>n.startsWith('.trip-backup-')),false);
});
test('대상 존재·동일 경로·동시 출판은 덮어쓰지 않는다',async t=>{
 const {source,dest}=await fixture(t);
 await assert.rejects(backupDatabase(source,source),/BACKUP_FAILED/);
 const outcomes=await Promise.allSettled([backupDatabase(source,dest),backupDatabase(source,dest)]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 const original=await readFile(dest);await assert.rejects(restoreDatabase(source,dest),/BACKUP_FAILED/);assert.deepEqual(await readFile(dest),original);
});
for(const kind of ['corrupt','truncated','empty','missing-migration','newer','checksum','foreign-key','missing-table','missing-index','missing-trigger'])test(`복원 거절: ${kind}, 원본과 대상 불변`,async t=>{
 const {root,source,db,dest}=await fixture(t);
 if(kind==='missing-migration')db.exec('DELETE FROM schema_migrations WHERE version=(SELECT MAX(version) FROM schema_migrations)');
 if(kind==='newer')db.exec("INSERT INTO schema_migrations VALUES (999,'future','unknown')");
 if(kind==='checksum')db.exec("UPDATE schema_migrations SET checksum='wrong' WHERE version=1");
 if(kind==='missing-table')db.exec('DROP TABLE drafts');
 if(kind==='missing-trigger'){const trigger=db.prepare("SELECT name FROM sqlite_schema WHERE type='trigger' LIMIT 1").get();db.exec(`DROP TRIGGER ${trigger.name}`);}
 if(kind==='missing-index')db.exec('DROP INDEX active_member_nickname');
 if(kind==='foreign-key'){db.pragma('foreign_keys=OFF');db.exec("INSERT INTO rooms(id,invite_code,status,version,created_at,host_member_id) VALUES ('r','invite','open',0,0,'missing')");}
 db.close();
 if(kind==='corrupt')await writeFile(source,'not a database');
 if(kind==='truncated')await writeFile(source,(await readFile(source)).subarray(0,100));
 if(kind==='empty')await writeFile(source,'');
 const original=await readFile(source);
 await assert.rejects(restoreDatabase(source,dest),e=>e.message==='BACKUP_FAILED: 백업 또는 복원 검증에 실패했습니다. 원본과 기존 대상은 덮어쓰지 않았습니다.');
 assert.deepEqual(await readFile(source),original);assert.equal((await readdir(root)).includes('backup.sqlite'),false);assert.equal((await readdir(root)).some(n=>n.startsWith('.trip-backup-')),false);
});

test('최종 경로 symlink는 거절하고 상위 symlink는 실제 경로로 정규화한다',async t=>{
 const {root,source,dest}=await fixture(t);
 const alias=join(root,'source-link.sqlite');await symlink(source,alias);
 await assert.rejects(backupDatabase(alias,dest),/BACKUP_FAILED/);
 await symlink(join(root,'missing.sqlite'),dest);
 await assert.rejects(backupDatabase(source,dest),/BACKUP_FAILED/);
 const parentAlias=join(root,'parent-link');await symlink(root,parentAlias);
 await backupDatabase(source,join(parentAlias,'normalized.sqlite'));
 assert.ok((await readdir(root)).includes('normalized.sqlite'));
 await assert.rejects(backupDatabase(source,join(root,'absent','copy.sqlite')),/BACKUP_FAILED/);
});

test('CLI 실제 backup/restore 성공과 기존 대상 실패는 경로·내용을 출력하지 않는다',async t=>{
 const {root,source,dest}=await fixture(t);
 const cli=new URL('../../tools/storage/backup.mjs',import.meta.url);
 for(const [command,input,output,code] of [['backup',source,dest,0],['restore',dest,join(root,'cli-restored.sqlite'),0],['restore',source,dest,1]]){
  const run=spawnSync(process.execPath,[cli.pathname,command,input,output],{encoding:'utf8',timeout:10000});
  assert.equal(run.status,code,run.stderr);
  const text=run.stdout+run.stderr;
  for(const hidden of [root,source,dest,'synthetic'])assert.equal(text.includes(hidden),false);
 }
});
