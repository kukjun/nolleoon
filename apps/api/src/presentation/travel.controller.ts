import {Controller,Get,Post,Patch,Param,Req,Res,Inject} from '@nestjs/common';
import type {Request,Response} from 'express';
import {AccountAuth} from '../application/account-auth.js';
import {TravelRooms} from '../application/travel-rooms.js';
import {TravelRuns} from '../application/travel-runs.js';
import {requireAccount} from './account.controller.js';
import {assertWebCommand} from './commands.js';
import {PUBLIC_ORIGIN} from './session.controller.js';
import {DomainFailure} from '../domain/failure.js';
@Controller('travel-rooms')
export class TravelRoomsController {
 constructor(@Inject(TravelRooms) private readonly rooms:TravelRooms,@Inject(TravelRuns) private readonly runs:TravelRuns,@Inject(AccountAuth) private readonly auth:AccountAuth,@Inject(PUBLIC_ORIGIN) private readonly origin:string){}
 private actor(req:Request,res:Response,command=false){res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');if(command)assertWebCommand(req,this.origin);return requireAccount(req,this.auth).accountId;}
 @Get() list(@Req() req:Request,@Res({passthrough:true}) res:Response){if(Object.keys(req.query).some(k=>k!=='cursor')||(req.query.cursor!==undefined&&typeof req.query.cursor!=='string'))throw new DomainFailure('INVALID_INPUT');return this.rooms.list(this.actor(req,res),req.query.cursor as string|undefined);}
 @Post() create(@Req() req:Request,@Res({passthrough:true}) res:Response){return this.rooms.create(this.actor(req,res,true),req.body);}
 @Get(':roomId') get(@Param('roomId') id:string,@Req() req:Request,@Res({passthrough:true}) res:Response){const a=this.actor(req,res);this.runs.maintain(a,id);return this.rooms.get(a,id);}
 @Patch(':roomId') update(@Param('roomId') id:string,@Req() req:Request,@Res({passthrough:true}) res:Response){return this.rooms.update(this.actor(req,res,true),id,req.body);}
 @Post(':roomId/status') status(@Param('roomId') id:string,@Req() req:Request,@Res({passthrough:true}) res:Response){return this.rooms.status(this.actor(req,res,true),id,req.body);}
 @Post(':roomId/invite') invite(@Param('roomId') id:string,@Req() req:Request,@Res({passthrough:true}) res:Response){return this.rooms.issueInvite(this.actor(req,res,true),id,req.body);}
 @Post(':roomId/invite/revoke') revoke(@Param('roomId') id:string,@Req() req:Request,@Res({passthrough:true}) res:Response){return this.rooms.revokeInvite(this.actor(req,res,true),id,req.body);}
 @Post(':roomId/administrator') admin(@Param('roomId') id:string,@Req() req:Request,@Res({passthrough:true}) res:Response){return this.rooms.transfer(this.actor(req,res,true),id,req.body);}
 @Post(':roomId/leave') leave(@Param('roomId') id:string,@Req() req:Request,@Res({passthrough:true}) res:Response){return this.rooms.leave(this.actor(req,res,true),id,req.body);}
 @Post(':roomId/members/:membershipId/remove') remove(@Param('roomId') id:string,@Param('membershipId') memberId:string,@Req() req:Request,@Res({passthrough:true}) res:Response){return this.rooms.remove(this.actor(req,res,true),id,memberId,req.body);}
 @Get(':roomId/history') history(@Param('roomId') id:string,@Req() req:Request,@Res({passthrough:true}) res:Response){return this.runs.history(this.actor(req,res),id);}
 @Post(':roomId/runs') createRun(@Param('roomId') id:string,@Req() req:Request,@Res({passthrough:true}) res:Response){return this.runs.create(this.actor(req,res,true),id,req.body);}
 @Get(':roomId/runs/:runId') run(@Param('roomId') id:string,@Param('runId') runId:string,@Req() req:Request,@Res({passthrough:true}) res:Response){return this.runs.get(this.actor(req,res),id,runId);}
 @Post(':roomId/runs/:runId/start') start(@Param('roomId') id:string,@Param('runId') runId:string,@Req() req:Request,@Res({passthrough:true}) res:Response){return this.runs.start(this.actor(req,res,true),id,runId,req.body);}
 @Post(':roomId/runs/:runId/actions') action(@Param('roomId') id:string,@Param('runId') runId:string,@Req() req:Request,@Res({passthrough:true}) res:Response){return this.runs.action(this.actor(req,res,true),id,runId,req.body);}
}
@Controller('travel-invites')
export class TravelInvitesController {
 constructor(@Inject(TravelRooms) private readonly rooms:TravelRooms,@Inject(AccountAuth) private readonly auth:AccountAuth,@Inject(PUBLIC_ORIGIN) private readonly origin:string){}
 private headers(res:Response){res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');}
 @Get(':token/preview') preview(@Param('token') token:string,@Res({passthrough:true}) res:Response){this.headers(res);return this.rooms.preview(token);}
 @Post(':token/join') join(@Param('token') token:string,@Req() req:Request,@Res({passthrough:true}) res:Response){this.headers(res);assertWebCommand(req,this.origin);return this.rooms.join(requireAccount(req,this.auth).accountId,token,req.body);}
}
