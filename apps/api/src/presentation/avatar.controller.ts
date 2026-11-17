import {Controller,Get,Put,Req,Res,Param,Inject} from '@nestjs/common';
import type {Request,Response} from 'express';
import {Avatars} from '../application/avatars.js';
import {BrowserSessions} from '../application/browser-sessions.js';
import {PUBLIC_ORIGIN} from './session.controller.js';
import {assertWebCommand,requestActor} from './commands.js';
function noStore(response:Response){response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');}
@Controller()
export class AvatarController {
 constructor(@Inject(Avatars)private readonly avatars:Avatars,@Inject(BrowserSessions)private readonly sessions:BrowserSessions,@Inject(PUBLIC_ORIGIN)private readonly origin:string){}
 @Get('avatar')get(@Req()req:Request,@Res({passthrough:true})res:Response){noStore(res);return this.avatars.get(requestActor(req,this.sessions));}
 @Put('avatar')preset(@Req()req:Request,@Res({passthrough:true})res:Response){noStore(res);assertWebCommand(req,this.origin);return this.avatars.preset(requestActor(req,this.sessions),req.body);}
 @Get('rooms/:code/avatars')room(@Req()req:Request,@Res({passthrough:true})res:Response,@Param('code')code:string){noStore(res);return this.avatars.roomProfiles(requestActor(req,this.sessions),code);}
}
