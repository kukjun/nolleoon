import {HttpException,type CanActivate,type ExecutionContext} from '@nestjs/common';
import type {Request,Response} from 'express';
import {BrowserSessions,type Clock} from '../application/browser-sessions.js';
import {RequestBudget} from '../application/request-budget.js';
import {sessionToken} from './commands.js';
export class RequestGuard implements CanActivate {
 private readonly budget=new RequestBudget();
 constructor(private readonly sessions:BrowserSessions,private readonly clock:Clock){}
 canActivate(context:ExecutionContext){
  const request=context.switchToHttp().getRequest<Request>();const response=context.switchToHttp().getResponse<Response>();
  const path=request.path.toLowerCase().replace(/\/+$/,'');
  if(path==='/api/health')return true;
  if(request.body!==undefined&&Buffer.byteLength(JSON.stringify(request.body),'utf8')>65536)throw new HttpException('요청 본문이 너무 큽니다.',413);
  let actor:string|undefined;
  try{actor=this.sessions.require(sessionToken(request)).id;}catch{/* 신원 실패는 controller가 동일한 안전 응답으로 처리한다. */}
  const identity=actor?`session:${actor}`:`anonymous:${request.socket.remoteAddress??'unknown'}`;
  const now=this.clock.now();const write=request.method!=='GET';
  const limits:[string,number][]=[[`${identity}:${write?'write':'read'}`,actor?(write?180:600):120]];
  if(actor&&write&&(/^\/api\/rooms\/?$/.test(path)||path.endsWith('/join')))limits.push([`${identity}:room-entry`,30]);
  for(const [key,limit] of limits){const result=this.budget.consume(key,limit,now);if(!result.allowed){response.setHeader('Retry-After',String(result.retryAfter));throw new HttpException('요청이 너무 많습니다.',429);}}
  return true;
 }
}
