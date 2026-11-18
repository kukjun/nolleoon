import test from 'node:test';
import assert from 'node:assert/strict';
import {validLegacyPreview} from '../../apps/web/src/api/travel-legacy-client.ts';
test('legacy start dates require valid epoch milliseconds, never inferred from link time',()=>{const item={runId:'r',type:'team',status:'completed',linkState:'available',createdAt:1234};const valid=x=>validLegacyPreview({items:[x],nextCursor:null});assert.equal(valid(item),true);for(const createdAt of [undefined,null,'1234',NaN,-1,1.5,8640000000000001])assert.equal(valid({...item,createdAt}),false);});
