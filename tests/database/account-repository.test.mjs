import test from 'node:test';import assert from 'node:assert/strict';import Database from 'better-sqlite3';
import {migrate,SqliteUnitOfWork} from '../../apps/api/dist/infrastructure/sqlite/index.js';
test('account repository enforces profile CAS, one-use OAuth, browser revocation and rollback',()=>{
 const db=new Database(':memory:');db.pragma('foreign_keys=ON');migrate(db);const u=new SqliteUnitOfWork(db);
 try{u.run(({accountAuth:r})=>{
 r.insertAccount({id:'a',createdAt:1,status:'active',displayName:'여행자',presetId:'preset-01',revision:0});
 assert.equal(r.updateProfile('a',0,'새이름','preset-02'),true);assert.equal(r.updateProfile('a',0,'stale','preset-03'),false);
 r.insertIdentity('kakao','subject','a');assert.deepEqual(r.findIdentity('kakao','subject'),{accountId:'a'});
 r.insertAttempt({stateHash:'s',browserHash:'b',codeHash:null,returnPath:'/travel',createdAt:1,expiresAt:2,status:'pending',previousSessionHash:null});
 assert.equal(r.claimAttempt('s','c'),true);assert.equal(r.claimAttempt('s','c'),false);assert.equal(r.consumeAttempt('s'),true);assert.equal(r.consumeAttempt('s'),false);
 r.insertSession({tokenHash:'t',accountId:'a',browserHash:'b',createdAt:1,expiresAt:3,revokedAt:null});r.revokeBrowserSessions('b',2);assert.equal(r.findSession('t').revokedAt,2);
 });assert.throws(()=>u.run(({accountAuth:r})=>{r.insertAccount({id:'rollback',createdAt:1,status:'active',displayName:'X',presetId:'preset-01',revision:0});throw Error('rollback');}));
 assert.equal(u.run(r=>r.accountAuth.findAccount('rollback')),undefined);
 }finally{db.close();}
});
