import test from 'node:test';import assert from 'node:assert/strict';
import {SettlementMonitor} from '../../apps/api/dist/infrastructure/sessions/settlement-monitor.js';
test('정산 monitor는 실패 내용을 숨기고 다음 tick을 유지하며 종료 시 멈춘다',(t)=>{
 t.mock.timers.enable({apis:['setInterval']});let calls=0;const messages=[];t.mock.method(console,'error',(...args)=>messages.push(args));
 const monitor=new SettlementMonitor({sweep(){calls++;throw new Error('private vote reason');}});monitor.onModuleInit();assert.equal(calls,1);t.mock.timers.tick(1000);assert.equal(calls,2);assert.deepEqual(messages,[['round_settlement_failed'],['round_settlement_failed']]);monitor.onModuleDestroy();t.mock.timers.tick(2000);assert.equal(calls,2);
});
