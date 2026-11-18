import {Controller,Get,Put,Req,Res,Param,Inject,BadRequestException,ForbiddenException} from '@nestjs/common';
import type {Request,Response} from 'express';
import {AccountAvatars,type AccountAvatarActor} from '../application/account-avatars.js';
import {AccountAuth} from '../application/account-auth.js';
import {requireAccount} from './account.controller.js';
import {PUBLIC_ORIGIN} from './session.controller.js';
import {assertWebCommand} from './commands.js';
import {imageBody,noStore,imageResponse,withAvatarUpload} from './avatar-http.js';
export abstract class AccountAvatarRoutes {
 constructor(protected readonly avatars:AccountAvatars){}
 protected abstract actor(req:Request):AccountAvatarActor;
 protected abstract command(req:Request,binary?:boolean):void;
 @Get('account/avatar')get(@Req()req:Request,@Res({passthrough:true})res:Response){noStore(res);return this.avatars.get(this.actor(req));}
 @Put('account/avatar')preset(@Req()req:Request,@Res({passthrough:true})res:Response){noStore(res);this.command(req);return this.avatars.preset(this.actor(req),req.body);}
 @Put('account/avatar/image')async upload(@Req()req:Request,@Res({passthrough:true})res:Response){
  noStore(res);const actor=this.actor(req);
  this.command(req,true);
  const type=req.headers['content-type'];if(!type||!['image/jpeg','image/png','image/webp'].includes(type))throw new BadRequestException();
  const revision=req.headers['x-avatar-revision'];if(typeof revision!=='string'||!/^(0|[1-9]\d*)$/.test(revision))throw new BadRequestException();
  return withAvatarUpload(async()=>this.avatars.upload(actor,Number(revision),await imageBody(req),type));
 }
 @Get('account/avatar/image')own(@Req()req:Request,@Res()res:Response){imageResponse(res,this.avatars.ownImage(this.actor(req)));}
 @Get('travel-rooms/:roomId/avatars')room(@Req()req:Request,@Res({passthrough:true})res:Response,@Param('roomId')id:string){noStore(res);return this.avatars.roomProfiles(this.actor(req),id);}
 @Get('travel-rooms/:roomId/avatars/:memberId/image')member(@Req()req:Request,@Res()res:Response,@Param('roomId')roomId:string,@Param('memberId')id:string){imageResponse(res,this.avatars.roomImage(this.actor(req),roomId,id));}
}

@Controller()
export class AccountAvatarController extends AccountAvatarRoutes {
 constructor(@Inject(AccountAvatars) avatars:AccountAvatars,@Inject(AccountAuth) private readonly auth:AccountAuth,@Inject(PUBLIC_ORIGIN) private readonly origin:string){super(avatars);}
 protected actor(req:Request){return requireAccount(req,this.auth);}
 protected command(req:Request,binary=false){
  if(!binary){assertWebCommand(req,this.origin);return;}
  if(req.headers.origin!==this.origin||req.headers['x-trip-court-request']!=='1'||(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin'))throw new ForbiddenException();
 }
}
