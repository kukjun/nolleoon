import {StartTrial} from '../application/start-trial.js';
import {Controller,Get,Post,Param,Req,Res,Inject} from '@nestjs/common';
import type {Request,Response} from 'express';
import type {RoomSnapshot} from '@trip-court/contracts';
import {Rooms} from '../application/rooms.js';
import {BrowserSessions} from '../application/browser-sessions.js';
import {DomainFailure} from '../domain/failure.js';
import {PUBLIC_ORIGIN} from './session.controller.js';
import {requestActor,assertWebCommand,assertEmptyCommand} from './commands.js';
@Controller('rooms')
export class RoomsController {
 constructor(@Inject(StartTrial) private readonly starter:StartTrial,@Inject(Rooms) private readonly rooms:Rooms,@Inject(BrowserSessions) private readonly sessions:BrowserSessions,@Inject(PUBLIC_ORIGIN) private readonly origin:string){}
 private nickname(request:Request){assertWebCommand(request,this.origin);if(Object.keys(request.body).length!==1||!Object.hasOwn(request.body,'nickname'))throw new DomainFailure('INVALID_INPUT');return request.body.nickname as unknown;}
 @Post()
 create(@Req() request:Request,@Res({passthrough:true}) response:Response):RoomSnapshot{response.setHeader('Cache-Control','no-store');const actor=requestActor(request,this.sessions);return this.rooms.create(actor,this.nickname(request));}
 @Post(':code/join')
 join(@Param('code') code:string,@Req() request:Request,@Res({passthrough:true}) response:Response):RoomSnapshot{response.setHeader('Cache-Control','no-store');const actor=requestActor(request,this.sessions);return this.rooms.join(actor,code,this.nickname(request));}
 private single(request:Request,key:string){assertWebCommand(request,this.origin);if(Object.keys(request.body).length!==1||!Object.hasOwn(request.body,key))throw new DomainFailure('INVALID_INPUT');return request.body[key] as unknown;}
 @Post(':code/role')
 role(@Param('code') code:string,@Req() request:Request,@Res({passthrough:true}) response:Response):RoomSnapshot{response.setHeader('Cache-Control','no-store');return this.rooms.changeRole(requestActor(request,this.sessions),code,this.single(request,'role'));}
 @Post(':code/exclude')
 exclude(@Param('code') code:string,@Req() request:Request,@Res({passthrough:true}) response:Response):RoomSnapshot{response.setHeader('Cache-Control','no-store');return this.rooms.excludeMember(requestActor(request,this.sessions),code,this.single(request,'memberId'));}
 @Post(':code/start')
 start(@Param('code') code:string,@Req() request:Request,@Res({passthrough:true}) response:Response):RoomSnapshot{response.setHeader('Cache-Control','no-store');const actor=requestActor(request,this.sessions);assertWebCommand(request,this.origin);const gameId=this.starter.execute(actor,code,request.body);return this.rooms.read(actor,code,gameId);}
 @Post(':code/consent')
 consent(@Param('code') code:string,@Req() request:Request,@Res({passthrough:true}) response:Response):RoomSnapshot{response.setHeader('Cache-Control','no-store');const actor=requestActor(request,this.sessions);assertWebCommand(request,this.origin);return this.rooms.decideConsent(actor,code,request.body);}
 @Post(':code/settings')
 settings(@Param('code') code:string,@Req() request:Request,@Res({passthrough:true}) response:Response):RoomSnapshot{response.setHeader('Cache-Control','no-store');const actor=requestActor(request,this.sessions);assertWebCommand(request,this.origin);return this.rooms.saveSettings(actor,code,request.body);}
 @Post(':code/heartbeat')
 heartbeat(@Param('code') code:string,@Req() request:Request,@Res({passthrough:true}) response:Response):RoomSnapshot{response.setHeader('Cache-Control','no-store');const actor=requestActor(request,this.sessions);assertWebCommand(request,this.origin);assertEmptyCommand(request);return this.rooms.heartbeat(actor,code);}
 @Get(':code')
 read(@Param('code') code:string,@Req() request:Request,@Res({passthrough:true}) response:Response):RoomSnapshot{response.setHeader('Cache-Control','no-store');return this.rooms.read(requestActor(request,this.sessions),code);}
}
