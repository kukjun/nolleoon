import {resolve} from 'node:path';
import {apiFixture} from '../../tests/support/api-fixture.mjs';
const fixture=await apiFixture({publicOrigin:'http://127.0.0.1:4184',port:4184,staticRoot:resolve(import.meta.dirname,'../../apps/web/dist')});
let closing=false;async function close(){if(closing)return;closing=true;await fixture.close();process.exit(0);}
process.once('SIGTERM',()=>void close());process.once('SIGINT',()=>void close());
