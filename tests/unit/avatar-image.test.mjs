import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {SharpAvatarProcessor} from '../../apps/api/dist/infrastructure/images/avatar-processor.js';
test('raster encoder removes EXIF and rejects mismatched type, animation, oversized pixels and SVG',async()=>{
 const p=new SharpAvatarProcessor();const bytes=await sharp({create:{width:400,height:200,channels:3,background:'blue'}}).withMetadata({orientation:6}).jpeg().toBuffer();
 const result=await p.thumbnail(bytes,'image/jpeg');const meta=await sharp(result).metadata();assert.equal(meta.width,256);assert.equal(meta.height,256);assert.equal(meta.exif,undefined);assert.equal(meta.icc,undefined);assert.equal(meta.format,'webp');
 for(const [input,mime] of [[Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),'image/png'],[bytes,'image/png'],[Buffer.from('GIF89a'),'image/gif'],[bytes.subarray(0,30),'image/jpeg']])await assert.rejects(p.thumbnail(input,mime));
 const large=await sharp({create:{width:2001,height:2000,channels:3,background:'red'}}).png().toBuffer();await assert.rejects(p.thumbnail(large,'image/png'));
 const animated=Buffer.alloc(4*8*3);animated.fill(255,4*4*3);const webp=await sharp(animated,{raw:{width:4,height:8,channels:3,pageHeight:4}}).webp({loop:0,delay:[100,100]}).toBuffer();assert.ok((await sharp(webp).metadata()).pages>1);await assert.rejects(p.thumbnail(webp,'image/webp'));
});
