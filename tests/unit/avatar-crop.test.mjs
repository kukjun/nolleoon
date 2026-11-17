import test from 'node:test';import assert from 'node:assert/strict';
import {cropSquare} from '../../apps/web/src/avatar-crop.ts';
test('square crop stays in source bounds with zoom and reposition',()=>{
 assert.deepEqual(cropSquare(800,400,1),{sx:200,sy:0,size:400});
 assert.deepEqual(cropSquare(800,400,2,1,0),{sx:600,sy:0,size:200});
 assert.deepEqual(cropSquare(400,800,1,0,1),{sx:0,sy:400,size:400});
});
test('crop rejects invalid and oversized decoded images',()=>{
 for(const values of [[0,1,1],[4000,2000,1],[20,20,0],[20,20,4],[20,20,1,2],[NaN,20,1]])assert.throws(()=>cropSquare(...values));
});
