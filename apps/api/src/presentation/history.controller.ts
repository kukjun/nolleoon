import {Controller,Get,Inject,Param,Req,Res} from '@nestjs/common';
import type {Request,Response} from 'express';
import {PersonalHistory} from '../application/personal-history.js';
import {BrowserSessions} from '../application/browser-sessions.js';
import {DomainFailure} from '../domain/failure.js';
import {requestActor} from './commands.js';
@Controller('history')
export class HistoryController {
 constructor(@Inject(PersonalHistory) private readonly history:PersonalHistory,@Inject(BrowserSessions) private readonly sessions:BrowserSessions){}
 @Get()
 list(@Req() request:Request,@Res({passthrough:true}) response:Response){
  response.setHeader('Cache-Control','no-store');
  if(Object.keys(request.query).some(key=>key!=='cursor'))throw new DomainFailure('INVALID_INPUT');
  return this.history.list(requestActor(request,this.sessions),request.query.cursor);
 }
 @Get(':gameId')
 detail(@Param('gameId') gameId:string,@Req() request:Request,@Res({passthrough:true}) response:Response){
  response.setHeader('Cache-Control','no-store');
  if(Object.keys(request.query).length)throw new DomainFailure('INVALID_INPUT');
  return this.history.detail(requestActor(request,this.sessions),gameId);
 }
}
