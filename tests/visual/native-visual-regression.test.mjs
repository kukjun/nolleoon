import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {compare} from '../../tools/mobile/native-visual-regression.mjs';
const baseline=resolve('tests/visual/native-proposed');
function fixture(){const dir=mkdtempSync(join(tmpdir(),'synthetic-visual-'));const candidate=join(dir,'candidate');cpSync(baseline,candidate,{recursive:true});return{dir,candidate};}
test('same synthetic bytes compare exactly; unchanged never grants acceptance',async()=>{const f=fixture();try{const report=await compare(baseline,f.candidate,join(f.dir,'diff'));assert.equal(report.status,'unchanged');assert.equal(report.acceptance,false);assert.equal(report.scenes.length,6);assert.ok(report.scenes.every(x=>x.changedPixels===0));await assert.rejects(()=>compare(baseline,f.candidate,join(f.dir,'diff')));}finally{rmSync(f.dir,{recursive:true,force:true});}});
test('font mismatch blocks comparison instead of silently refreshing baseline',async()=>{const f=fixture();try{const file=join(f.candidate,'manifest.json'),m=JSON.parse(readFileSync(file));m.environment.fontSha256='0'.repeat(64);writeFileSync(file,JSON.stringify(m));const report=await compare(baseline,f.candidate,join(f.dir,'diff'));assert.equal(report.status,'blocked');assert.equal(report.environmentMatches,false);assert.deepEqual(report.scenes,[]);}finally{rmSync(f.dir,{recursive:true,force:true});}});
test('missing manifest fields and tampered baseline fail closed',async()=>{const f=fixture();try{const bad=join(f.dir,'bad');cpSync(baseline,bad,{recursive:true});writeFileSync(join(bad,'manifest.json'),'{}');await assert.rejects(()=>compare(bad,f.candidate,join(f.dir,'missing')));cpSync(baseline,bad,{recursive:true});const file=join(bad,'00-auth.png');const data=readFileSync(file);data[data.length-1]^=1;writeFileSync(file,data);await assert.rejects(()=>compare(bad,f.candidate,join(f.dir,'corrupt')),/checksum/);}finally{rmSync(f.dir,{recursive:true,force:true});}});
