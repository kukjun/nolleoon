import { resolve } from 'node:path';
import { apiFixture } from '../../tests/support/api-fixture.mjs';
const fixture=await apiFixture({publicOrigin:'http://127.0.0.1:4179',port:4179,staticRoot:resolve(import.meta.dirname,'../../apps/web/dist')});
let closing=false;
async function close() {if(closing)return;closing=true;await fixture.close();process.exit(0);}
process.once('SIGTERM',()=>void close());process.once('SIGINT',()=>void close());
console.log('합성 데이터·임시 DB 브라우저 시험 서버 준비');
