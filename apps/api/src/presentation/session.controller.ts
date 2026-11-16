import { Controller, Get, Post, Req, Res, Inject, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { BrowserSessions, SESSION_LIFETIME_MS, SessionRequired } from '../application/browser-sessions.js';
export const PUBLIC_ORIGIN = Symbol('PUBLIC_ORIGIN');
export const SESSION_COOKIE = '__Host-trip_session';
function tokenFrom(request: Request): string | undefined {
  const cookies=(request.headers.cookie??'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(`${SESSION_COOKIE}=`));
  if(cookies.length!==1) return undefined;
  return cookies[0].slice(SESSION_COOKIE.length+1);
}
@Controller('session')
export class SessionController {
  constructor(@Inject(BrowserSessions) private readonly sessions: BrowserSessions, @Inject(PUBLIC_ORIGIN) private readonly origin: string) {}
  @Get()
  get(@Req() request: Request, @Res({passthrough:true}) response: Response) {
    response.setHeader('Cache-Control','no-store');
    try { this.sessions.require(tokenFrom(request)); return {authenticated:true}; }
    catch(error) { if(error instanceof SessionRequired) throw new UnauthorizedException('브라우저 신원을 확인할 수 없습니다.'); throw error; }
  }
  @Post()
  open(@Req() request: Request, @Res({passthrough:true}) response: Response) {
    response.setHeader('Cache-Control','no-store');
    if(request.headers.origin!==this.origin || request.headers['x-trip-court-request']!=='1' || (request.headers['sec-fetch-site'] && request.headers['sec-fetch-site']!=='same-origin')) throw new ForbiddenException('같은 출처의 요청만 허용합니다.');
    if(!request.is('application/json') || !request.body || Array.isArray(request.body) || Object.keys(request.body).length) throw new BadRequestException('세션 발급 요청은 빈 JSON 객체만 받습니다.');
    const result=this.sessions.open(tokenFrom(request));
    response.cookie(SESSION_COOKIE,result.token,{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:SESSION_LIFETIME_MS});
    return {authenticated:true};
  }
}
