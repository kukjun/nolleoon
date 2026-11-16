import test from 'node:test';import assert from 'node:assert/strict';
import {PresenceMonitor} from '../../apps/api/dist/infrastructure/sessions/presence-monitor.js';
test('접속 감지 실패는 비밀 원문 없이 고정 사건명만 기록하고 종료할 수 있다',()=>{
 const logged=[];const original=console.error;console.error=(...args)=>logged.push(args);const monitor=new PresenceMonitor({sweep(){throw new Error('private-token-and-nickname');}});
 try{monitor.onModuleInit();assert.deepEqual(logged,[['presence_sweep_failed']]);}finally{monitor.onModuleDestroy();console.error=original;}
});
