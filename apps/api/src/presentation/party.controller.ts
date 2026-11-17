import {Controller,Get,Put,Inject,Param,Req,Res} from '@nestjs/common';
import type {Request,Response} from 'express';
import {PartyGames} from '../application/party-games.js';
import {BrowserSessions} from '../application/browser-sessions.js';
import {PUBLIC_ORIGIN} from './session.controller.js';
import {requestActor,assertWebCommand} from './commands.js';
@Controller('party')
export class PartyController {
 constructor(@Inject(PartyGames) private readonly party:PartyGames,@Inject(BrowserSessions) private readonly sessions:BrowserSessions,@Inject(PUBLIC_ORIGIN) private readonly origin:string){}
 @Get('rooms/:code')
 read(@Param('code') code:string,@Req() request:Request,@Res({passthrough:true}) response:Response){response.setHeader('Cache-Control','no-store');return this.party.read(requestActor(request,this.sessions),code);}
 @Put('rooms/:code/selection')
 select(@Param('code') code:string,@Req() request:Request,@Res({passthrough:true}) response:Response){response.setHeader('Cache-Control','no-store');const actor=requestActor(request,this.sessions);assertWebCommand(request,this.origin);return this.party.select(actor,code,request.body);}
}
