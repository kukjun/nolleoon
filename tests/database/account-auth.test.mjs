import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openSqlite,migrate,SqliteUnitOfWork} from '../../apps/api/dist/infrastructure/sqlite/index.js';
import {AccountAuth} from '../../apps/api/dist/application/account-auth.js';
import {SecureTokens} from '../../apps/api/dist/infrastructure/sessions/secure-tokens.js';
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'trip-account-db-')),path=join(dir,'test.sqlite');let db=openSqlite(path);migrate(db);let now=1000;let provider={authorizationUrl:s=>'https://kauth.kakao.com/oauth/authorize?state='+s,exchange:async()=>({subject:'123'})};const build=()=>new AccountAuth(new SqliteUnitOfWork(db),{now:()=>now},new SecureTokens(),provider);t.after(()=>{if(db.open)db.close();rmSync(dir,{recursive:true,force:true});});return {get db(){return db},get auth(){return build()},setProvider:p=>provider=p,setNow:n=>now=n,reopen:()=>{db.close();db=openSqlite(path);migrate(db);}};}
test('native SQLite concurrent callbacks have one account; state/code replay and restart preserve identity',async t=>{
 const f=fixture(t),a=f.auth.begin('/travel'),b=f.auth.begin('/travel');const [one,two]=await Promise.all([f.auth.callback(a.state,a.browserToken,'one'),f.auth.callback(b.state,b.browserToken,'two')]);assert.equal(one.account.id,two.account.id);assert.equal(f.db.prepare('SELECT count(*) n FROM accounts').get().n,1);
 const c=f.auth.begin('/travel');await assert.rejects(f.auth.callback(c.state,c.browserToken,'one'));f.reopen();assert.equal(f.auth.require(one.token).accountId,one.account.id);await assert.rejects(f.auth.callback(a.state,a.browserToken,'one'));
 const dump=JSON.stringify(f.db.prepare('SELECT * FROM oauth_attempts').all());assert.equal(dump.includes(a.state),false);assert.equal(dump.includes('"one"'),false);assert.equal(dump.includes(a.browserToken),false);
});
test('native failure rolls back account/session creation but does not unclaim the external authorization code',async t=>{
 const f=fixture(t);f.db.exec("CREATE TRIGGER fixture_fail BEFORE INSERT ON account_sessions BEGIN SELECT RAISE(ABORT,'fixture fault'); END");const a=f.auth.begin('/travel');await assert.rejects(f.auth.callback(a.state,a.browserToken,'one'));assert.equal(f.db.prepare('SELECT count(*) n FROM accounts').get().n,0);assert.equal(f.db.prepare('SELECT count(*) n FROM provider_identities').get().n,0);assert.equal(f.db.prepare('SELECT status FROM oauth_attempts').get().status,'exchanging');f.db.exec('DROP TRIGGER fixture_fail');await assert.rejects(f.auth.callback(a.state,a.browserToken,'one'));
 const b=f.auth.begin('/travel');await assert.rejects(f.auth.callback(b.state,b.browserToken,'one'));assert.equal(f.db.prepare('SELECT count(*) n FROM account_sessions').get().n,0);
});
test('native logout and supersession races cannot revive an account session',async t=>{
 const f=fixture(t);let resolve;f.setProvider({authorizationUrl:s=>'https://kauth.kakao.com/oauth/authorize?state='+s,exchange:()=>new Promise(r=>resolve=r)});const a=f.auth.begin('/travel');const pending=f.auth.callback(a.state,a.browserToken,'one');f.auth.logout(undefined,a.browserToken);resolve({subject:'123'});await assert.rejects(pending);assert.equal(f.db.prepare('SELECT count(*) n FROM account_sessions').get().n,0);
 const b=f.auth.begin('/travel',a.browserToken);const second=f.auth.callback(b.state,b.browserToken,'two');f.setNow(301000);resolve({subject:'123'});await assert.rejects(second);assert.equal(f.db.prepare('SELECT count(*) n FROM accounts').get().n,0);
});
