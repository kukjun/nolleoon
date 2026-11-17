import test from 'node:test';import assert from 'node:assert/strict';import Database from 'better-sqlite3';
import {migrate} from '../../apps/api/dist/infrastructure/sqlite/index.js';
import {migrations} from '../../apps/api/dist/infrastructure/sqlite/migrations.js';
import {seedLegacyNine,legacyRows} from '../support/legacy-nine.mjs';
test('schema9→10 재판 어댑터는 기존 행·checksum을 보존하고 재실행해도 중복이 없다',()=>{
 const db=new Database(':memory:');db.pragma('foreign_keys=ON');try{seedLegacyNine(db);const before=legacyRows(db),checks=db.prepare('SELECT * FROM schema_migrations').all();
 migrate(db);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM game_runs').get().n,2);
 assert.deepEqual(legacyRows(db),before);assert.deepEqual(db.prepare('SELECT * FROM schema_migrations WHERE version<=9').all(),checks);migrate(db);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM game_runs').get().n,2);
 }finally{db.close();}
});
test('공통 활성게임·동결배정·교차방 FK와 실패 migration rollback',()=>{
 const db=new Database(':memory:');db.pragma('foreign_keys=ON');try{seedLegacyNine(db);migrate(db);
 assert.throws(()=>db.exec("INSERT INTO game_runs VALUES ('draw','legacy-room','draw','active',0,'{}',2000)"),/UNIQUE/);
 db.exec("UPDATE games SET status='result' WHERE id='legacy-active'");
 db.exec("INSERT INTO game_runs VALUES ('draw','legacy-room','draw','active',0,'{}',2000)");
 assert.throws(()=>db.exec("INSERT INTO run_participants VALUES ('draw','legacy-room','absent','가짜',1)"),/FOREIGN KEY/);
 db.exec("INSERT INTO run_participants VALUES ('draw','legacy-room','legacy-member','합성',1)");
 assert.throws(()=>db.exec("INSERT INTO run_allocations VALUES ('draw','legacy-member',NULL,NULL)"),/CHECK/);
 db.exec("INSERT INTO run_allocations VALUES ('draw','legacy-member',NULL,1)");
 assert.throws(()=>db.exec("UPDATE run_allocations SET winning=0"),/immutable/);
 assert.throws(()=>db.exec("INSERT INTO games VALUES ('other-court','legacy-room','defense','사건','벌칙',180,0,3000)"),/UNIQUE/);
 const count=db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n;
 assert.throws(()=>migrate(db,[...migrations,{version:migrations.length+1,name:'synthetic-failure',sql:'CREATE TABLE temporary_failure(id); THIS IS NOT SQL;'}]));
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n,count);assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_schema WHERE name='temporary_failure'").get().n,0);
 }finally{db.close();}
});
