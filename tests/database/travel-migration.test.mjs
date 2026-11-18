import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {migrate} from '../../apps/api/dist/infrastructure/sqlite/index.js';
import {migrations} from '../../apps/api/dist/infrastructure/sqlite/migrations.js';
test('travel schema is additive, preserves legacy and separates account identities',()=>{
 const db=new Database(':memory:');db.pragma('foreign_keys=ON');
 try {migrate(db,migrations.slice(0,11));db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run('legacy','legacyhash',1,100);
 const before=db.prepare('SELECT * FROM sessions').all();migrate(db);
 assert.ok(migrations.length>=12);assert.equal(db.prepare('SELECT MAX(version) v FROM schema_migrations').get().v,migrations.at(-1).version);
 assert.deepEqual(db.prepare('SELECT * FROM sessions').all(),before);
 assert.equal(db.prepare('SELECT count(*) n FROM travel_rooms').get().n,0);
 db.exec("INSERT INTO accounts VALUES ('a',1,'active','여행자','preset-01',0); INSERT INTO provider_identities VALUES ('kakao','subject','a')");
 assert.throws(()=>db.exec("INSERT INTO provider_identities VALUES ('kakao','subject','a')"));
 assert.deepEqual(db.pragma('foreign_key_check'),[]);assert.equal(db.pragma('integrity_check',{simple:true}),'ok');
 }finally{db.close();}
});
test('travel membership and active game constraints cannot cross rooms',()=>{
 const db=new Database(':memory:');db.pragma('foreign_keys=ON');try{migrate(db);
 db.exec("INSERT INTO accounts VALUES ('a',1,'active','여행자','preset-01',0); INSERT INTO travel_rooms VALUES ('r','여행',NULL,NULL,'open',0,1,NULL); INSERT INTO travel_memberships VALUES ('m','r','a',1,NULL,NULL); UPDATE travel_rooms SET administrator_membership_id='m' WHERE id='r'");
 assert.throws(()=>db.exec("INSERT INTO travel_memberships VALUES ('m2','r','a',2,NULL,NULL)"));
 db.exec("INSERT INTO travel_runs VALUES ('g','r','team','draft','m','m',0,'{}','{}',NULL,'[\"m\"]',1,NULL,NULL,NULL)");
 assert.throws(()=>db.exec("INSERT INTO travel_runs VALUES ('g2','r','draw','active','m','m',0,'{}','{}',NULL,'[]',1,2,NULL,NULL)"));
 assert.throws(()=>db.exec("INSERT INTO travel_run_participants VALUES ('g','wrong','m',2)"));
 assert.deepEqual(db.pragma('foreign_key_check'),[]);
 }finally{db.close();}
});
