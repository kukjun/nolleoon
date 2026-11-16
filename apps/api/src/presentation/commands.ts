import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { BrowserSessions } from '../application/browser-sessions.js';
export const SESSION_COOKIE='__Host-trip_session';
export function sessionToken(request:Request):string|undefined {
 const cookies=(request.headers.cookie??'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(`${SESSION_COOKIE}=`));
 return cookies.length===1?cookies[0].slice(SESSION_COOKIE.length+1):undefined;
}
export function requestActor(request:Request,sessions:BrowserSessions):{id:string} {
 return sessions.require(sessionToken(request));
}
export function assertWebCommand(request:Request,origin:string):void {
 if(request.headers.origin!==origin || request.headers['x-trip-court-request']!=='1' || (request.headers['sec-fetch-site'] && request.headers['sec-fetch-site']!=='same-origin'))throw new ForbiddenException();
 if(!request.is('application/json') || !request.body || typeof request.body!=='object' || Array.isArray(request.body))throw new BadRequestException();
}
export function assertEmptyCommand(request:Request):void { if(Object.keys(request.body).length)throw new BadRequestException(); }
