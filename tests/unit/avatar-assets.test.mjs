import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';
const root=new URL('../../apps/web/src/assets/avatars/',import.meta.url);
test('ten original avatar renditions have bounded 256 square WebP data and stable imports',async()=>{
 const files=(await readdir(root)).filter(name=>name.endsWith('.webp')).sort();assert.deepEqual(files,Array.from({length:10},(_,i)=>`preset-${String(i+1).padStart(2,'0')}.webp`));
 const manifest=await readFile(new URL('../../apps/web/src/avatar-presets.ts',import.meta.url),'utf8');
 for(const filename of files){const bytes=await readFile(new URL(filename,root));assert.ok(bytes.length<65536);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(bytes.toString('ascii',12,16),'VP8 ');assert.deepEqual([...bytes.subarray(23,26)],[0x9d,1,0x2a]);assert.equal(bytes.readUInt16LE(26)&0x3fff,256);assert.equal(bytes.readUInt16LE(28)&0x3fff,256);assert.ok(manifest.includes(`./assets/avatars/${filename}`));}
});
