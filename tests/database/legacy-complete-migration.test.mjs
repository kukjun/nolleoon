import {restoreWithEmptyJournals as restoreDatabase} from '../support/restore-journals.mjs';
// Offline synthetic fixture only. Canonical row bytes, not identical SQLite file layout after migration.
// Does not certify production data, all game branches, physical devices, rollout or rollback cutover.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {openSqlite,migrate,migrations} from '../../apps/api/dist/infrastructure/sqlite/index.js';
import {backupDatabase} from '../../apps/api/dist/infrastructure/sqlite/backup.js';
import {seedLegacyComplete,snapshotLegacyComplete,assertLegacyComplete,canonicalLegacyBytes} from '../support/legacy-nine-complete.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function health(db){assert.deepEqual(db.pragma('foreign_key_check'),[]);assert.equal(db.pragma('integrity_check',{simple:true}),'ok');}
test('complete schema9 fixture covers every legacy table and detects omitted/modified records',async t=>{
 const root=await mkdtemp(join(tmpdir(),'complete-legacy-proof-'));t.after(()=>rm(root,{recursive:true,force:true}));const db=openSqlite(join(root,'source.sqlite'));t.after(()=>db.close());seedLegacyComplete(db);health(db);
 const before=snapshotLegacyComplete(db);assertLegacyComplete(before);assert.deepEqual(Object.keys(before).sort(),db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row=>row.name));
 const missing=JSON.parse(JSON.stringify(before));delete missing.votes;assert.throws(()=>assertLegacyComplete(missing));
 const omitted=JSON.parse(JSON.stringify(before));omitted.votes.pop();assert.throws(()=>assert.deepEqual(omitted,before));assert.notEqual(hash(canonicalLegacyBytes(omitted)),hash(canonicalLegacyBytes(before)));
 const changed=JSON.parse(JSON.stringify(before));changed.defenses[0].text='synthetic corruption';assert.throws(()=>assert.deepEqual(changed,before));assert.notEqual(hash(canonicalLegacyBytes(changed)),hash(canonicalLegacyBytes(before)));
});
test('online schema9 backup/restore, upgrade to current schema and second backup preserve all legacy values and receipts',async t=>{
 const root=await mkdtemp(join(tmpdir(),'complete-legacy-rehearsal-'));t.after(()=>rm(root,{recursive:true,force:true}));const path=join(root,'source.sqlite');const source=openSqlite(path);t.after(()=>source.close());seedLegacyComplete(source);health(source);
 const before=snapshotLegacyComplete(source);assertLegacyComplete(before);const bytes=canonicalLegacyBytes(before),digest=hash(bytes);const originalFile=await readFile(path);
 await backupDatabase(path,join(root,'schema9-backup.sqlite'));assert.deepEqual(await readFile(path),originalFile);assert.deepEqual(snapshotLegacyComplete(source),before);
 await restoreDatabase(join(root,'schema9-backup.sqlite'),join(root,'upgraded.sqlite'));const upgraded=openSqlite(join(root,'upgraded.sqlite'));t.after(()=>upgraded.close());assert.equal(upgraded.prepare('SELECT MAX(version) AS n FROM schema_migrations').get().n,migrations.length);assert.deepEqual(canonicalLegacyBytes(snapshotLegacyComplete(upgraded)),bytes);health(upgraded);
 migrate(upgraded);assert.equal(upgraded.prepare('SELECT MAX(version) AS n FROM schema_migrations').get().n,migrations.length);assert.ok(migrations.length>=12);health(upgraded);
 assert.deepEqual(snapshotLegacyComplete(upgraded),before);assert.equal(hash(canonicalLegacyBytes(snapshotLegacyComplete(upgraded))),digest);
 assert.equal(upgraded.prepare("SELECT COUNT(*) AS n FROM game_runs WHERE type='trial'").get().n,3);
 assert.deepEqual(upgraded.prepare('SELECT id,room_id,type,status,version,created_at FROM game_runs ORDER BY id').all(),before.games.map(game=>({id:game.id,room_id:game.room_id,type:'trial',status:game.status==='result'?'completed':game.status==='interrupted'?'interrupted':'active',version:game.version,created_at:game.created_at})).sort((a,b)=>a.id.localeCompare(b.id)));
 await backupDatabase(join(root,'upgraded.sqlite'),join(root,'latest-schema-backup.sqlite'));await restoreDatabase(join(root,'latest-schema-backup.sqlite'),join(root,'final.sqlite'));const restored=openSqlite(join(root,'final.sqlite'));try{health(restored);assert.deepEqual(snapshotLegacyComplete(restored),before);assert.deepEqual(canonicalLegacyBytes(snapshotLegacyComplete(restored)),bytes);assert.equal(hash(canonicalLegacyBytes(snapshotLegacyComplete(restored))),digest);}finally{restored.close();}
 assert.equal(source.prepare('SELECT MAX(version) AS n FROM schema_migrations').get().n,9);assert.deepEqual(snapshotLegacyComplete(source),before);
});
