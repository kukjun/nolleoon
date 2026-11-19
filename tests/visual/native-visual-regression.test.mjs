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
test('one actual pixel change is detected, then restored bytes compare unchanged',async()=>{
 const f=fixture();const {chromium}=await import('playwright');const {createHash}=await import('node:crypto');const browser=await chromium.launch();
 try{const file=join(f.candidate,'00-auth.png'),original=readFileSync(file);const page=await browser.newPage();await page.route('**/*',r=>r.abort());
 const png=await page.evaluate(async data=>{const image=new globalThis.Image();image.src=data;await image.decode();const canvas=globalThis.document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const pixel=ctx.getImageData(0,0,1,1);pixel.data[0]^=255;ctx.putImageData(pixel,0,0);return canvas.toDataURL('image/png').split(',')[1];},'data:image/png;base64,'+original.toString('base64'));
 writeFileSync(file,Buffer.from(png,'base64'));const manifestFile=join(f.candidate,'manifest.json'),manifest=JSON.parse(readFileSync(manifestFile));manifest.images['00-auth']=createHash('sha256').update(readFileSync(file)).digest('hex');writeFileSync(manifestFile,JSON.stringify(manifest));
 const changed=await compare(baseline,f.candidate,join(f.dir,'changed'));assert.equal(changed.status,'changed');assert.equal(changed.scenes[0].changedPixels,1);assert.ok(changed.scenes.slice(1).every(x=>x.changedPixels===0));
 writeFileSync(file,original);manifest.images['00-auth']=createHash('sha256').update(original).digest('hex');writeFileSync(manifestFile,JSON.stringify(manifest));assert.equal((await compare(baseline,f.candidate,join(f.dir,'restored'))).status,'unchanged');
 }finally{await browser.close();rmSync(f.dir,{recursive:true,force:true});}
});
test('capture provenance rejects source, dirty, commit or environment changes',async()=>{
 const {assertStableCapture}=await import('../../tools/mobile/native-visual-regression.mjs');const snapshot={source:{commit:'a',dirty:false,sourceDigest:'x'},environment:{fontSha256:'y'}};
 assert.doesNotThrow(()=>assertStableCapture(snapshot,globalThis.structuredClone(snapshot)));
 for(const after of [{...snapshot,source:{...snapshot.source,commit:'b'}},{...snapshot,source:{...snapshot.source,dirty:true}},{...snapshot,source:{...snapshot.source,sourceDigest:'changed'}},{...snapshot,environment:{fontSha256:'changed'}}])assert.throws(()=>assertStableCapture(snapshot,after),/changed during capture/);
});
