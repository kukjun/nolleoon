import {restoreWithEmptyJournals as restoreDatabase} from '../support/restore-journals.mjs';
import sharp from 'sharp';
import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openSqlite,migrate,migrations} from '../../apps/api/dist/infrastructure/sqlite/index.js';
import {backupDatabase} from '../../apps/api/dist/infrastructure/sqlite/backup.js';
import {seedLegacyComplete} from '../support/legacy-nine-complete.mjs';
function snapshot(db,tables){return Object.fromEntries(tables.map(name=>[name,db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all().map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,Buffer.isBuffer(v)?v.toString('hex'):v])))]));}
test('full schema11 legacy plus party/avatar rows survive backup restore and additive travel migration',async t=>{
 const root=await mkdtemp(join(tmpdir(),'travel-preservation-'));t.after(()=>rm(root,{recursive:true,force:true}));const source=openSqlite(join(root,'source.sqlite'));seedLegacyComplete(source);migrate(source,migrations.slice(0,11));
 const room=source.prepare('SELECT id FROM rooms LIMIT 1').get().id,member=source.prepare('SELECT id,session_id FROM room_members WHERE room_id=? LIMIT 1').get(room);
 source.prepare("INSERT INTO game_runs VALUES ('synthetic-team',?,'team','completed',0,'{}',999)").run(room);
 source.prepare("INSERT INTO run_participants VALUES ('synthetic-team',?,?,'synthetic',1)").run(room,member.id);
 source.prepare("INSERT INTO run_allocations VALUES ('synthetic-team',?,1,NULL)").run(member.id);
 source.prepare("INSERT INTO game_runs VALUES ('synthetic-draw',?,'draw','completed',1,'{}',1000)").run(room);
 source.prepare("INSERT INTO run_participants VALUES ('synthetic-draw',?,?,'synthetic',1)").run(room,member.id);
 source.prepare("INSERT INTO run_allocations VALUES ('synthetic-draw',?,NULL,1)").run(member.id);
 source.prepare("INSERT INTO run_reveals VALUES ('synthetic-draw',?,1001)").run(member.id);
 source.prepare("INSERT INTO party_receipts VALUES (?,'synthetic-reveal',?,'reveal','synthetic','synthetic-draw')").run(room,member.session_id);
 const photo=await sharp({create:{width:2,height:2,channels:3,background:'#9a7b65'}}).webp().toBuffer();
 source.prepare('INSERT INTO avatar_profiles VALUES (?,NULL,1,?)').run(member.session_id,photo);
 const otherSession=source.prepare('SELECT id FROM sessions WHERE id!=? LIMIT 1').get(member.session_id).id;
 source.prepare("INSERT INTO avatar_profiles VALUES (?,'preset-02',2,NULL)").run(otherSession);
 const tables=source.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name!='schema_migrations' ORDER BY name").all().map(r=>r.name);const before=snapshot(source,tables);assert.equal(tables.length,23);for(const table of tables)assert.ok(before[table].length>0,`${table} fixture must include a row`);source.close();
 await backupDatabase(join(root,'source.sqlite'),join(root,'backup.sqlite'));await restoreDatabase(join(root,'backup.sqlite'),join(root,'restore.sqlite'));const restored=openSqlite(join(root,'restore.sqlite'));try{assert.deepEqual(snapshot(restored,tables),before);migrate(restored);assert.deepEqual(snapshot(restored,tables),before);assert.deepEqual(restored.pragma('foreign_key_check'),[]);assert.equal(restored.pragma('integrity_check',{simple:true}),'ok');assert.equal(restored.prepare('SELECT COUNT(*) n FROM accounts').get().n,0);}finally{restored.close();}
});
