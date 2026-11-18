import {imageBody,noStore,imageResponse,withAvatarUpload} from './avatar-http.js';
import {Controller,Get,Put,Req,Res,Param,Inject,BadRequestException,ForbiddenException} from '@nestjs/common';
import type {Request,Response} from 'express';
import {Avatars} from '../application/avatars.js';
import {BrowserSessions} from '../application/browser-sessions.js';
import {PUBLIC_ORIGIN} from './session.controller.js';
import {assertWebCommand,requestActor} from './commands.js';
@Controller()
export class AvatarController {
 constructor(@Inject(Avatars)private readonly avatars:Avatars,@Inject(BrowserSessions)private readonly sessions:BrowserSessions,@Inject(PUBLIC_ORIGIN)private readonly origin:string){}
 @Get('avatar')get(@Req()req:Request,@Res({passthrough:true})res:Response){noStore(res);return this.avatars.get(requestActor(req,this.sessions));}
 @Put('avatar')preset(@Req()req:Request,@Res({passthrough:true})res:Response){noStore(res);assertWebCommand(req,this.origin);return this.avatars.preset(requestActor(req,this.sessions),req.body);}
 @Put('avatar/image')async upload(@Req()req:Request,@Res({passthrough:true})res:Response){
  noStore(res);const actor=requestActor(req,this.sessions);
  if(req.headers.origin!==this.origin||req.headers['x-trip-court-request']!=='1'||(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin'))throw new ForbiddenException();
  const type=req.headers['content-type'];if(!type||!['image/jpeg','image/png','image/webp'].includes(type))throw new BadRequestException();
  const revision=req.headers['x-avatar-revision'];if(typeof revision!=='string'||!/^(0|[1-9]\d*)$/.test(revision))throw new BadRequestException();
  return withAvatarUpload(async()=>this.avatars.upload(actor,Number(revision),await imageBody(req),type));
 }
 @Get('avatar/image')own(@Req()req:Request,@Res()res:Response){imageResponse(res,this.avatars.ownImage(requestActor(req,this.sessions)));}
 @Get('rooms/:code/avatars')room(@Req()req:Request,@Res({passthrough:true})res:Response,@Param('code')code:string){noStore(res);return this.avatars.roomProfiles(requestActor(req,this.sessions),code);}
 @Get('rooms/:code/avatars/:memberId/image')member(@Req()req:Request,@Res()res:Response,@Param('code')code:string,@Param('memberId')id:string){imageResponse(res,this.avatars.roomImage(requestActor(req,this.sessions),code,id));}
}
