import {Controller,Get,Put,Req,Res,Param,Inject,BadRequestException,ForbiddenException,PayloadTooLargeException,RequestTimeoutException,ServiceUnavailableException} from '@nestjs/common';
import type {Request,Response} from 'express';
import {Avatars} from '../application/avatars.js';
import {BrowserSessions} from '../application/browser-sessions.js';
import {PUBLIC_ORIGIN} from './session.controller.js';
import {assertWebCommand,requestActor} from './commands.js';
async function imageBody(request:Request):Promise<Buffer>{
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
function noStore(response:Response){response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');}
function imageResponse(response:Response,bytes:Uint8Array){noStore(response);response.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");response.type('image/webp').send(Buffer.from(bytes));}
@Controller()
export class AvatarController {
 private uploads=0;
 constructor(@Inject(Avatars)private readonly avatars:Avatars,@Inject(BrowserSessions)private readonly sessions:BrowserSessions,@Inject(PUBLIC_ORIGIN)private readonly origin:string){}
 @Get('avatar')get(@Req()req:Request,@Res({passthrough:true})res:Response){noStore(res);return this.avatars.get(requestActor(req,this.sessions));}
 @Put('avatar')preset(@Req()req:Request,@Res({passthrough:true})res:Response){noStore(res);assertWebCommand(req,this.origin);return this.avatars.preset(requestActor(req,this.sessions),req.body);}
 @Put('avatar/image')async upload(@Req()req:Request,@Res({passthrough:true})res:Response){
  noStore(res);const actor=requestActor(req,this.sessions);
  if(req.headers.origin!==this.origin||req.headers['x-trip-court-request']!=='1'||(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin'))throw new ForbiddenException();
  const type=req.headers['content-type'];if(!type||!['image/jpeg','image/png','image/webp'].includes(type))throw new BadRequestException();
  const revision=req.headers['x-avatar-revision'];if(typeof revision!=='string'||!/^(0|[1-9]\d*)$/.test(revision))throw new BadRequestException();
  if(this.uploads>=16)throw new ServiceUnavailableException();
  this.uploads++;
  try{return await this.avatars.upload(actor,Number(revision),await imageBody(req),type);}finally{this.uploads--;}
 }
 @Get('avatar/image')own(@Req()req:Request,@Res()res:Response){imageResponse(res,this.avatars.ownImage(requestActor(req,this.sessions)));}
 @Get('rooms/:code/avatars')room(@Req()req:Request,@Res({passthrough:true})res:Response,@Param('code')code:string){noStore(res);return this.avatars.roomProfiles(requestActor(req,this.sessions),code);}
 @Get('rooms/:code/avatars/:memberId/image')member(@Req()req:Request,@Res()res:Response,@Param('code')code:string,@Param('memberId')id:string){imageResponse(res,this.avatars.roomImage(requestActor(req,this.sessions),code,id));}
}
