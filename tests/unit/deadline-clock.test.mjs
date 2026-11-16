import {test} from 'node:test';import assert from 'node:assert/strict';
import {remainingSeconds} from '../../apps/web/src/api/deadline-clock.ts';
test('남은 시간은 서버 기준과 단조 시계만 사용하고 0에서 멈춘다',()=>{assert.equal(remainingSeconds(181000,1000,500,1500),179);assert.equal(remainingSeconds(181000,1000,500,999999),0);assert.equal(remainingSeconds(181000,1000,500,0),180);});
