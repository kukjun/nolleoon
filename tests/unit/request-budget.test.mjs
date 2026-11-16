import test from 'node:test';import assert from 'node:assert/strict';
import {RequestBudget} from '../../apps/api/dist/application/request-budget.js';
test('세션별 예산은 3초 polling·공유IP의 다른 신원을 분리하고 분 경계에서 복구한다',()=>{
 const budget=new RequestBudget();for(let i=0;i<600;i++)assert.equal(budget.consume('a',600,1000).allowed,true);assert.equal(budget.consume('a',600,1000).allowed,false);assert.equal(budget.consume('b',600,1000).allowed,true);assert.equal(budget.consume('a',600,61000).allowed,true);
});
test('회전하는 익명 key는 bounded map을 넘기지 않고 TTL 뒤 제거된다',()=>{
 const budget=new RequestBudget(4);for(let i=0;i<100;i++)budget.consume(`key${i}`,3,1000);assert.ok(budget.size<=5);assert.equal(budget.consume('key999',3,1000).allowed,false);assert.equal(budget.consume('fresh',3,61000).allowed,true);assert.ok(budget.size<=2);
});
