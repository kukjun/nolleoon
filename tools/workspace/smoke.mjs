import { spawn } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '../..');
const children = [];
const temporary = await mkdtemp(resolve(tmpdir(),"trip-court-smoke-"));
async function freePort() {
  const server = createServer();
  await new Promise((ok, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', ok); });
  const port = server.address().port;
  await new Promise(ok => server.close(ok));
  return port;
}
function start(args, cwd, env) {
  const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env }, stdio:['ignore','pipe','pipe'] });
  const state = { child, output:'', error:null, closed:false };
  state.done = new Promise(ok => child.once('close', code => { state.closed=true; state.code=code; ok(); }));
  child.once('error', error => { state.error=error; });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { state.output=(state.output+data).slice(-8000); });
  children.push(state);
  return state;
}
async function response(url, state) {
  for (let i=0;i<80;i++) {
    if (state.error || state.closed) throw new Error(`프로세스 조기 종료: ${state.error ?? state.output}`);
    try { const r=await fetch(url,{signal:AbortSignal.timeout(300)}); if(r.ok) return r; } catch { /* 기동 대기 중 연결 실패는 제한 횟수 내 재시도한다. */ }
    await delay(100);
  }
  throw new Error(`기동 시간 초과: ${state.output}`);
}
try {
  await access(resolve(root,'apps/api/dist/main.js'));
  await access(resolve(root,'apps/web/dist/index.html'));
  const bad = start(['apps/api/dist/main.js'], root, {API_PORT:'invalid',API_HOST:'127.0.0.1'});
  await Promise.race([bad.done, delay(5000).then(() => { if(!bad.closed) throw new Error('환경 오류 시 종료하지 않았습니다.'); })]);
  assert.notEqual(bad.code, 0);
  assert.match(bad.output, /API_PORT/);
  const apiPort=await freePort();
  const webPort=await freePort();
  const api=start(['apps/api/dist/main.js'],root,{API_PORT:String(apiPort),API_HOST:'127.0.0.1',DB_PATH:resolve(temporary,'test.sqlite'),PUBLIC_ORIGIN:`http://127.0.0.1:${webPort}`});
  assert.deepEqual(await (await response(`http://127.0.0.1:${apiPort}/api/health`,api)).json(), {status:'ok',service:'trip-court-api'});
  const web=start([resolve(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(webPort),'--strictPort'],resolve(root,'apps/web'),{API_PORT:String(apiPort)});
  const html=await (await response(`http://127.0.0.1:${webPort}`,web)).text();
  assert.match(html, /<title>Trip Court<\/title>/);
  const bundle=html.match(/src="([^"]+\.tsx)"/);
  assert.ok(bundle, 'Vite 개발 진입점 참조');
  assert.ok((await response(`http://127.0.0.1:${webPort}${bundle[1]}`,web)).ok);
  const origin=`http://127.0.0.1:${webPort}`;
  assert.equal((await fetch(`${origin}/api/session`)).status,401);
  const session=await fetch(`${origin}/api/session`,{method:'POST',headers:{origin,'content-type':'application/json','x-trip-court-request':'1'},body:'{}'});
  assert.equal(session.status,201);assert.deepEqual(await session.json(),{authenticated:true});
  const cookie=session.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(`${origin}/api/session`,{headers:{cookie}})).status,200);
  console.log('실제 API 기동·Vite dev /api 프록시·세션 발급/복구 HTTP smoke 통과 (브라우저 렌더/E2E 아님)');
} catch(error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode=1;
} finally {
  for(const state of children) if(!state.closed) state.child.kill('SIGTERM');
  await Promise.all(children.map(async state => {
    await Promise.race([state.done, delay(2000)]);
    if(!state.closed) { state.child.kill('SIGKILL'); await state.done; }
  }));
  await rm(temporary,{recursive:true,force:true});
}
