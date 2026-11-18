import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openSqlite,migrate,migrations} from '../../apps/api/dist/infrastructure/sqlite/index.js';
import {backupDatabase,restoreDatabase} from '../../apps/api/dist/infrastructure/sqlite/backup.js';
import {seedLegacyComplete} from '../support/legacy-nine-complete.mjs';
function snapshot(db,tables){return Object.fromEntries(tables.map(name=>[name,db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all().map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,Buffer.isBuffer(v)?v.toString('hex'):v])))]));}
test('full schema11 legacy plus party/avatar rows survive backup restore and additive travel migration',async t=>{
 const root=await mkdtemp(join(tmpdir(),'travel-preservation-'));t.after(()=>rm(root,{recursive:true,force:true}));const source=openSqlite(join(root,'source.sqlite'));seedLegacyComplete(source);migrate(source,migrations.slice(0,11));
 const room=source.prepare('SELECT id FROM rooms LIMIT 1').get().id,member=source.prepare('SELECT id,session_id FROM room_members WHERE room_id=? LIMIT 1').get(room);
 source.prepare("INSERT INTO game_runs VALUES ('synthetic-team',?,'team','completed',0,'{}',999)").run(room);
 source.prepare("INSERT INTO run_participants VALUES ('synthetic-team',?,?,'synthetic',1)").run(room,member.id);
 source.prepare("INSERT INTO avatar_profiles VALUES (?,'preset-02',1,NULL)").run(member.session_id);
 const tables=source.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name!='schema_migrations' ORDER BY name").all().map(r=>r.name);const before=snapshot(source,tables);assert.equal(tables.length,23);source.close();
 await backupDatabase(join(root,'source.sqlite'),join(root,'backup.sqlite'));await restoreDatabase(join(root,'backup.sqlite'),join(root,'restore.sqlite'));const restored=openSqlite(join(root,'restore.sqlite'));try{assert.deepEqual(snapshot(restored,tables),before);migrate(restored);assert.deepEqual(snapshot(restored,tables),before);assert.deepEqual(restored.pragma('foreign_key_check'),[]);assert.equal(restored.pragma('integrity_check',{simple:true}),'ok');assert.equal(restored.prepare('SELECT COUNT(*) n FROM accounts').get().n,0);}finally{restored.close();}
});
