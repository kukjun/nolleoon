import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openSqlite,migrate,migrations,SqliteUnitOfWork} from '../../apps/api/dist/infrastructure/sqlite/index.js';
import {Avatars} from '../../apps/api/dist/application/avatars.js';
test('v9 to avatar schema preserves prior checksums/data; profile survives reopen and rolls back atomically',()=>{
 const directory=mkdtempSync(join(tmpdir(),'avatar-migrate-'));const path=join(directory,'db.sqlite');let db=openSqlite(path);
 try{
 migrate(db,migrations.slice(0,9));db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run('owner','hash',0,100000);
 const before=db.prepare('SELECT * FROM schema_migrations ORDER BY version').all();
 migrate(db);assert.deepEqual(db.prepare('SELECT * FROM schema_migrations WHERE version<=9 ORDER BY version').all(),before);assert.equal(db.prepare('SELECT token_hash FROM sessions').get().token_hash,'hash');
 let uow=new SqliteUnitOfWork(db);let avatars=new Avatars(uow);avatars.preset({id:'owner'},{presetId:'preset-07',expectedRevision:0});
 assert.throws(()=>uow.run(r=>{r.avatars.save({sessionId:'owner',presetId:'preset-03',revision:2,imageBytes:null});throw new Error('rollback');}));
 assert.equal(avatars.get({id:'owner'}).presetId,'preset-07');db.close();db=openSqlite(path);uow=new SqliteUnitOfWork(db);avatars=new Avatars(uow);assert.equal(avatars.get({id:'owner'}).revision,1);assert.equal(avatars.get({id:'owner'}).presetId,'preset-07');
 assert.throws(()=>db.prepare('UPDATE avatar_profiles SET preset_id=?').run('bad'));
 assert.equal(db.pragma('foreign_key_check').length,0);assert.equal(db.pragma('integrity_check',{simple:true}),'ok');
 }finally{db.close();rmSync(directory,{recursive:true,force:true});}
});
