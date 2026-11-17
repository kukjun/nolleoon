import test from 'node:test';import assert from 'node:assert/strict';
import {balancedTeams,allocateLots} from '../../apps/api/dist/domain/party-allocation.js';
test('균형 팀은 홀짝·팀수 경계에서 모든 대상 한 번씩만 배정한다',()=>{
 for(let n=2;n<=12;n++)for(let count=2;count<=n;count++){
 const ids=Array.from({length:n},(_,i)=>String(i));const result=balancedTeams(ids,count,{nextInt:max=>max-1});assert.deepEqual(result.map(x=>x.memberId).sort(),ids.sort());const sizes=Array.from({length:count},(_,i)=>result.filter(x=>x.team===i+1).length);assert.ok(Math.max(...sizes)-Math.min(...sizes)<=1);assert.ok(sizes.every(n=>n>0));}
 for(const count of [0,1,4,1.5])assert.throws(()=>balancedTeams(['a','b','c'],count,{nextInt:()=>0}));
});
test('제비는 고정 N당첨·한명한장, 잘못된 난수·중복대상은 거부한다',()=>{
 for(let n=1;n<=5;n++){const result=allocateLots(['a','b','c','d','e'],n,{nextInt:()=>0});assert.equal(result.filter(x=>x.winning).length,n);assert.equal(new Set(result.map(x=>x.memberId)).size,5);}
 assert.throws(()=>allocateLots(['a','a'],1,{nextInt:()=>0}));for(const n of [0,3,1.5])assert.throws(()=>allocateLots(['a','b'],n,{nextInt:()=>0}));for(const invalid of [-1,2,NaN])assert.throws(()=>allocateLots(['a','b'],1,{nextInt:()=>invalid}));
});
