import { Controller, Get, Post, Req, Res, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import { BrowserSessions, SESSION_LIFETIME_MS } from '../application/browser-sessions.js';
export const PUBLIC_ORIGIN = Symbol('PUBLIC_ORIGIN');
import type { SessionSnapshot } from '@trip-court/contracts';
import { SESSION_COOKIE, sessionToken, requestActor, assertWebCommand, assertEmptyCommand } from './commands.js';
@Controller('session')
export class SessionController {
  constructor(@Inject(BrowserSessions) private readonly sessions: BrowserSessions, @Inject(PUBLIC_ORIGIN) private readonly origin: string) {}
  @Get()
  get(@Req() request: Request, @Res({passthrough:true}) response: Response):SessionSnapshot {
    response.setHeader('Cache-Control','no-store');
    requestActor(request,this.sessions);return {authenticated:true};
  }
  @Post('renew')
  renew(@Req() request: Request, @Res({passthrough:true}) response: Response):SessionSnapshot {
    response.setHeader('Cache-Control','no-store');
    assertWebCommand(request,this.origin);assertEmptyCommand(request);
    const result=this.sessions.renew(sessionToken(request));
    response.cookie(SESSION_COOKIE,result.token,{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:SESSION_LIFETIME_MS});
    return {authenticated:true};
  }
  @Post()
  open(@Req() request: Request, @Res({passthrough:true}) response: Response):SessionSnapshot {
    response.setHeader('Cache-Control','no-store');
    assertWebCommand(request,this.origin);assertEmptyCommand(request);
    const result=this.sessions.open(sessionToken(request));
    response.cookie(SESSION_COOKIE,result.token,{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:SESSION_LIFETIME_MS});
    return {authenticated:true};
  }
}
