import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openSqlite} from '../../apps/api/dist/infrastructure/sqlite/index.js';
import {backupDatabase,restoreDatabase} from '../../apps/api/dist/infrastructure/sqlite/backup.js';
import {seedLegacyNine,legacyRows} from '../support/legacy-nine.mjs';
test('합성 schema9의 신원·열린방·진행 재판·완료 기록은 온라인 백업과 새 경로 복원에서 보존된다',async t=>{
 const root=await mkdtemp(join(tmpdir(),'party-legacy-'));t.after(()=>rm(root,{recursive:true,force:true}));const source=join(root,'source.sqlite'),backup=join(root,'backup.sqlite'),restored=join(root,'restored.sqlite');const db=openSqlite(source);t.after(()=>db.open&&db.close());seedLegacyNine(db);
 assert.equal(db.prepare('SELECT MAX(version) AS n FROM schema_migrations').get().n,9);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM games WHERE status='result'").get().n,1);
 const before=legacyRows(db);await backupDatabase(source,backup);await restoreDatabase(backup,restored);const result=openSqlite(restored);try{assert.deepEqual(legacyRows(result),before);}finally{result.close();}
 await assert.rejects(backupDatabase(source,source),/BACKUP_FAILED/);await assert.rejects(restoreDatabase(backup,restored),/BACKUP_FAILED/);
 const corrupt=join(root,'corrupt.sqlite');await writeFile(corrupt,'synthetic corruption');await assert.rejects(restoreDatabase(corrupt,join(root,'bad.sqlite')),/BACKUP_FAILED/);
});
