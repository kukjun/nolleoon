import {NextGame} from '../application/next-game.js';
import {SubmitVote} from '../application/submit-vote.js';
import {TrialProgress} from '../application/trial-progress.js';
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
 constructor(@Inject(NextGame) private readonly next:NextGame,@Inject(SubmitVote) private readonly voter:SubmitVote,@Inject(TrialProgress) private readonly progress:TrialProgress,@Inject(StartTrial) private readonly starter:StartTrial,@Inject(Rooms) private readonly rooms:Rooms,@Inject(BrowserSessions) private readonly sessions:BrowserSessions,@Inject(PUBLIC_ORIGIN) private readonly origin:string){}
 private nickname(request:Request){assertWebCommand(request,this.origin);if(Object.keys(request.body).length!==1||!Object.hasOwn(request.body,'nickname'))throw new DomainFailure('INVALID_INPUT');return request.body.nickname as unknown;}
 @Post()
 create(@Req() request:Request,@Res({passthrough:true}) response:Response):RoomSnapshot{response.setHeader('Cache-Control','no-store');const actor=requestActor(request,this.sessions);return this.rooms.create(actor,this.nickname(request));}
 @Post(':code/join')
 join(@Param('code') code:string,@Req() request:Request,@Res({passthrough:true}) response:Response):RoomSnapshot{response.setHeader('Cache-Control','no-store');const actor=requestActor(request,this.sessions);return this.rooms.join(actor,code,this.nickname(request));}
 private single(request:Request,key:string){assertWebCommand(request,this.origin);if(Object.keys(request.body).length!==1||!Object.hasOwn(request.body,key))throw new DomainFailure('INVALID_INPUT');return request.body[key] as unknown;}
 @Post(':code/next-game')
 nextGame(@Param('code') code:string,@Req() request:Request,@Res({passthrough:true}) response:Response){response.setHeader('Cache-Control','no-store');const actor=requestActor(request,this.sessions);assertWebCommand(request,this.origin);const receipt=this.next.execute(actor,code,request.body);return {snapshot:this.rooms.read(actor,code),receipt};}
 @Get(':code/games/:gameId')
 history(@Param('code') code:string,@Param('gameId') gameId:string,@Req() request:Request,@Res({passthrough:true}) response:Response){response.setHeader('Cache-Control','no-store');return this.rooms.history(requestActor(request,this.sessions),code,gameId);}
 private preparationCommand(request:Request,key:string){assertWebCommand(request,this.origin);const allowed=[key,'expectedPreparationVersion'];if(!Object.hasOwn(request.body,key)||Object.keys(request.body).some(k=>!allowed.includes(k)))throw new DomainFailure('INVALID_INPUT');return request.body as Record<string,unknown>;}
 @Post(':code/close')
 close(@Param('code') code:string,@Req() request:Request,@Res({passthrough:true}) response:Response):RoomSnapshot{response.setHeader('Cache-Control','no-store');return this.rooms.close(requestActor(request,this.sessions),code,this.single(request,'expectedMemberId'));}
 @Post(':code/leave')
 leave(@Param('code') code:string,@Req() request:Request,@Res({passthrough:true}) response:Response){response.setHeader('Cache-Control','no-store');return this.rooms.leave(requestActor(request,this.sessions),code,this.single(request,'expectedMemberId'));}
 @Post(':code/role')
 role(@Param('code') code:string,@Req() request:Request,@Res({passthrough:true}) response:Response):RoomSnapshot{response.setHeader('Cache-Control','no-store');const body=this.preparationCommand(request,'role');return this.rooms.changeRole(requestActor(request,this.sessions),code,body.role,body.expectedPreparationVersion);}
 @Post(':code/exclude')
 exclude(@Param('code') code:string,@Req() request:Request,@Res({passthrough:true}) response:Response):RoomSnapshot{response.setHeader('Cache-Control','no-store');const body=this.preparationCommand(request,'memberId');return this.rooms.excludeMember(requestActor(request,this.sessions),code,body.memberId,body.expectedPreparationVersion);}
 @Post(':code/games/:gameId/defense')
 defense(@Param('code') code:string,@Param('gameId') gameId:string,@Req() request:Request,@Res({passthrough:true}) response:Response):RoomSnapshot{response.setHeader('Cache-Control','no-store');const actor=requestActor(request,this.sessions);assertWebCommand(request,this.origin);this.progress.defense(actor,code,gameId,request.body);return this.rooms.read(actor,code);}
 @Post(':code/games/:gameId/duration')
 duration(@Param('code') code:string,@Param('gameId') gameId:string,@Req() request:Request,@Res({passthrough:true}) response:Response):RoomSnapshot{response.setHeader('Cache-Control','no-store');const actor=requestActor(request,this.sessions);assertWebCommand(request,this.origin);this.progress.duration(actor,code,gameId,request.body);return this.rooms.read(actor,code);}
 @Post(':code/games/:gameId/open-vote')
 openVote(@Param('code') code:string,@Param('gameId') gameId:string,@Req() request:Request,@Res({passthrough:true}) response:Response):RoomSnapshot{response.setHeader('Cache-Control','no-store');const actor=requestActor(request,this.sessions);assertWebCommand(request,this.origin);this.progress.open(actor,code,gameId,request.body);return this.rooms.read(actor,code);}
 @Post(':code/games/:gameId/vote')
 vote(@Param('code') code:string,@Param('gameId') gameId:string,@Req() request:Request,@Res({passthrough:true}) response:Response) {
  response.setHeader('Cache-Control','no-store');
  const actor=requestActor(request,this.sessions);
  assertWebCommand(request,this.origin);
  const receipt=this.voter.execute(actor,code,gameId,request.body);
  return {snapshot:this.rooms.read(actor,code),receipt};
 }
 @Post(':code/start')
 start(@Param('code') code:string,@Req() request:Request,@Res({passthrough:true}) response:Response):RoomSnapshot{response.setHeader('Cache-Control','no-store');const actor=requestActor(request,this.sessions);assertWebCommand(request,this.origin);this.starter.execute(actor,code,request.body);return this.rooms.read(actor,code);}
 @Post(':code/consent')
 consent(@Param('code') code:string,@Req() request:Request,@Res({passthrough:true}) response:Response):RoomSnapshot{response.setHeader('Cache-Control','no-store');const actor=requestActor(request,this.sessions);assertWebCommand(request,this.origin);return this.rooms.decideConsent(actor,code,request.body);}
 @Post(':code/settings')
 settings(@Param('code') code:string,@Req() request:Request,@Res({passthrough:true}) response:Response):RoomSnapshot{response.setHeader('Cache-Control','no-store');const actor=requestActor(request,this.sessions);assertWebCommand(request,this.origin);return this.rooms.saveSettings(actor,code,request.body);}
 @Post(':code/heartbeat')
 heartbeat(@Param('code') code:string,@Req() request:Request,@Res({passthrough:true}) response:Response):RoomSnapshot{response.setHeader('Cache-Control','no-store');const actor=requestActor(request,this.sessions);assertWebCommand(request,this.origin);assertEmptyCommand(request);return this.rooms.heartbeat(actor,code);}
 @Get(':code')
 read(@Param('code') code:string,@Req() request:Request,@Res({passthrough:true}) response:Response):RoomSnapshot{response.setHeader('Cache-Control','no-store');return this.rooms.read(requestActor(request,this.sessions),code);}
}
