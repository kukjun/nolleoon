import {BadRequestException,PayloadTooLargeException,RequestTimeoutException,ServiceUnavailableException} from '@nestjs/common';
import type {Request,Response} from 'express';
export async function imageBody(request:Request):Promise<Buffer>{
 if(request.headers['content-encoding'])throw new BadRequestException();
 const length=request.headers['content-length'];if(length&&(!/^\d+$/.test(length)||Number(length)>1048576))throw new PayloadTooLargeException();
 return new Promise((resolve,reject)=>{
  let size=0;const parts:Buffer[]=[];
  const cleanup=()=>{clearTimeout(timer);request.off('data',data);request.off('end',end);request.off('error',failed);request.off('aborted',aborted);};
  const failed=(error:Error)=>{cleanup();reject(error);};
  const aborted=()=>failed(new BadRequestException());
  const data=(chunk:Buffer)=>{size+=chunk.length;if(size>1048576){cleanup();request.resume();reject(new PayloadTooLargeException());return;}parts.push(chunk);};
  const end=()=>{cleanup();resolve(Buffer.concat(parts));};
  const timer=setTimeout(()=>{cleanup();request.resume();reject(new RequestTimeoutException());},5000);
  request.on('data',data);request.on('end',end);request.on('error',failed);request.on('aborted',aborted);
 });
}
export function noStore(response:Response){response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');}
export function imageResponse(response:Response,bytes:Uint8Array){noStore(response);response.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");response.type('image/webp').send(Buffer.from(bytes));}
let uploads=0;
export async function withAvatarUpload<T>(work:()=>Promise<T>):Promise<T>{if(uploads>=16)throw new ServiceUnavailableException();uploads++;try{return await work();}finally{uploads--;}}
