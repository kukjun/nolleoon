import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '../..');
const children = [];
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
  const api=start(['apps/api/dist/main.js'],root,{API_PORT:String(apiPort),API_HOST:'127.0.0.1'});
  assert.deepEqual(await (await response(`http://127.0.0.1:${apiPort}/api/health`,api)).json(), {status:'ok',service:'trip-court-api'});
  const webPort=await freePort();
  const web=start([resolve(root,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',String(webPort),'--strictPort'],resolve(root,'apps/web'),{});
  const html=await (await response(`http://127.0.0.1:${webPort}`,web)).text();
  assert.match(html, /<title>Trip Court<\/title>/);
  const bundle=html.match(/src="([^"]+\.js)"/);
  assert.ok(bundle, '빌드된 JS 번들 참조');
  assert.ok((await response(`http://127.0.0.1:${webPort}${bundle[1]}`,web)).ok);
  console.log('API 환경 오류 종료·헬스 JSON·web 정적 번들 HTTP smoke 통과 (브라우저 렌더/E2E 아님)');
} catch(error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode=1;
} finally {
  for(const state of children) if(!state.closed) state.child.kill('SIGTERM');
  await Promise.all(children.map(async state => {
    await Promise.race([state.done, delay(2000)]);
    if(!state.closed) { state.child.kill('SIGKILL'); await state.done; }
  }));
}
