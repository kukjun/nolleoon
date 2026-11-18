import {BadRequestException,ForbiddenException,UnauthorizedException} from '@nestjs/common';
import type {Request,Response} from 'express';

/** No cookie fallback. Reject ambiguous transports even if both credentials identify one account. */
export function assertNativeTransport(request:Request):void {
 if(request.headers.cookie!==undefined)throw new ForbiddenException();
}
export function nativeToken(request:Request):string {
 assertNativeTransport(request);
 const value=request.headers.authorization;
 const count=request.rawHeaders.filter((_,index)=>index%2===0&&request.rawHeaders[index].toLowerCase()==='authorization').length;
 if(count!==1||typeof value!=='string'||!/^Bearer [A-Za-z0-9_-]{43}$/.test(value))throw new UnauthorizedException();
 return value.slice(7);
}
export function assertJsonObject(request:Request):void {
 if(!request.is('application/json')||!request.body||typeof request.body!=='object'||Array.isArray(request.body))throw new BadRequestException();
}
export function assertNativeCommand(request:Request):void {nativeToken(request);assertJsonObject(request);}
export function nativeHeaders(response:Response):void {response.setHeader('Cache-Control','no-store');response.setHeader('Referrer-Policy','no-referrer');}
