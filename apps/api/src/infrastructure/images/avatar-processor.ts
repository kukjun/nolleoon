import sharp from 'sharp';
import type {AvatarImageProcessor} from '../../application/avatars.js';
import {DomainFailure} from '../../domain/failure.js';
// Never keep the original file, filename, EXIF, ICC or animation. Raster bytes only.
export class SharpAvatarProcessor implements AvatarImageProcessor {
 private inFlight=0;
 async thumbnail(bytes:Uint8Array,mime:string):Promise<Uint8Array>{
  if(this.inFlight>=2)throw new DomainFailure('TEMPORARILY_UNAVAILABLE');
  this.inFlight++;
  try{
   const expected:Record<string,string>={'image/png':'png','image/jpeg':'jpeg','image/webp':'webp'};
   if(!expected[mime])throw new DomainFailure('INVALID_INPUT');
   const input=Buffer.from(bytes);
   // Reject SVG and other decoders before metadata parsing, regardless of supplied MIME.
   const magic=input.subarray(0,12);
   const format=magic.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':magic[0]===255&&magic[1]===216&&magic[2]===255?'jpeg':magic.toString('ascii',0,4)==='RIFF'&&magic.toString('ascii',8,12)==='WEBP'?'webp':null;
   if(format!==expected[mime])throw new DomainFailure('INVALID_INPUT');
   const image=sharp(input,{limitInputPixels:4000000,failOn:'warning',sequentialRead:true});
   const meta=await image.metadata();
   if(meta.format!==format||(meta.pages??1)!==1||!meta.width||!meta.height||meta.width*meta.height>4000000)throw new DomainFailure('INVALID_INPUT');
   return await image.rotate().resize(256,256,{fit:'cover',position:'centre'}).webp({quality:80,effort:3}).timeout({seconds:5}).toBuffer();
  }catch(error){if(error instanceof DomainFailure)throw error;throw new DomainFailure('INVALID_INPUT');}
  finally{this.inFlight--;}
 }
}
