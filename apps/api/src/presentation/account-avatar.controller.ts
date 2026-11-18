import {Controller,Get,Put,Req,Res,Param,Inject,BadRequestException,ForbiddenException} from '@nestjs/common';
import type {Request,Response} from 'express';
import {AccountAvatars} from '../application/account-avatars.js';
import {AccountAuth} from '../application/account-auth.js';
import {requireAccount} from './account.controller.js';
import {PUBLIC_ORIGIN} from './session.controller.js';
import {assertWebCommand} from './commands.js';
import {imageBody,noStore,imageResponse,withAvatarUpload} from './avatar-http.js';
@Controller()
export class AccountAvatarController {
 constructor(@Inject(AccountAvatars)private readonly avatars:AccountAvatars,@Inject(AccountAuth)private readonly auth:AccountAuth,@Inject(PUBLIC_ORIGIN)private readonly origin:string){}
 @Get('account/avatar')get(@Req()req:Request,@Res({passthrough:true})res:Response){noStore(res);return this.avatars.get(requireAccount(req,this.auth));}
 @Put('account/avatar')preset(@Req()req:Request,@Res({passthrough:true})res:Response){noStore(res);assertWebCommand(req,this.origin);return this.avatars.preset(requireAccount(req,this.auth),req.body);}
 @Put('account/avatar/image')async upload(@Req()req:Request,@Res({passthrough:true})res:Response){
  noStore(res);const actor=requireAccount(req,this.auth);
  if(req.headers.origin!==this.origin||req.headers['x-trip-court-request']!=='1'||(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin'))throw new ForbiddenException();
  const type=req.headers['content-type'];if(!type||!['image/jpeg','image/png','image/webp'].includes(type))throw new BadRequestException();
  const revision=req.headers['x-avatar-revision'];if(typeof revision!=='string'||!/^(0|[1-9]\d*)$/.test(revision))throw new BadRequestException();
  return withAvatarUpload(async()=>this.avatars.upload(actor,Number(revision),await imageBody(req),type));
 }
 @Get('account/avatar/image')own(@Req()req:Request,@Res()res:Response){imageResponse(res,this.avatars.ownImage(requireAccount(req,this.auth)));}
 @Get('travel-rooms/:roomId/avatars')room(@Req()req:Request,@Res({passthrough:true})res:Response,@Param('roomId')id:string){noStore(res);return this.avatars.roomProfiles(requireAccount(req,this.auth),id);}
 @Get('travel-rooms/:roomId/avatars/:memberId/image')member(@Req()req:Request,@Res()res:Response,@Param('roomId')roomId:string,@Param('memberId')id:string){imageResponse(res,this.avatars.roomImage(requireAccount(req,this.auth),roomId,id));}
}
