import {Controller,Get,Post,Req,Res,Inject,BadRequestException} from '@nestjs/common';
import type {Request,Response} from 'express';
import {AccountAuth,ACCOUNT_SESSION_MS,ACCOUNT_FLOW_MS} from '../application/account-auth.js';
import {assertWebCommand,assertEmptyCommand} from './commands.js';
import {PUBLIC_ORIGIN} from './session.controller.js';
export const ACCOUNT_COOKIE='__Host-trip_account';
export const ACCOUNT_FLOW_COOKIE='__Host-trip_account_flow';
export function accountCookie(request:Request,name=ACCOUNT_COOKIE):string|undefined {
 const found=(request.headers.cookie??'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(`${name}=`));
 return found.length===1?found[0].slice(name.length+1):undefined;
}
export function requireAccount(request:Request,auth:AccountAuth){return auth.require(accountCookie(request));}
const cookieOptions={secure:true,httpOnly:true,sameSite:'strict' as const,path:'/'};
@Controller('account')
export class AccountController {
 constructor(@Inject(AccountAuth) private readonly auth:AccountAuth,@Inject(PUBLIC_ORIGIN) private readonly origin:string){}
 private headers(response:Response){response.setHeader('Cache-Control','no-store');response.setHeader('Referrer-Policy','no-referrer');}
 @Get('session')
 session(@Req() request:Request,@Res({passthrough:true}) response:Response){this.headers(response);return this.auth.session(accountCookie(request));}
 @Post('login')
 login(@Req() request:Request,@Res({passthrough:true}) response:Response){
  this.headers(response);assertWebCommand(request,this.origin);
  if(Object.keys(request.body).join(',')!=='returnTo')throw new BadRequestException();
  const result=this.auth.begin(request.body.returnTo,accountCookie(request,ACCOUNT_FLOW_COOKIE),accountCookie(request));
  // Lax is required for the provider's top-level cross-site GET callback only.
  response.cookie(ACCOUNT_FLOW_COOKIE,result.browserToken,{...cookieOptions,sameSite:'lax',maxAge:ACCOUNT_FLOW_MS});
  return {authorizationUrl:result.authorizationUrl};
 }
 @Get('callback')
 async callback(@Req() request:Request,@Res() response:Response){
  this.headers(response);const q=request.query,browser=accountCookie(request,ACCOUNT_FLOW_COOKIE);
  let returnPath='/travel';
  try{
   returnPath=this.auth.callbackReturnPath(q.state,browser);
   if(Object.keys(q).some(k=>!['state','code','error','error_description'].includes(k))||typeof q.state!=='string'||(q.error!==undefined&&(typeof q.error!=='string'||q.code!==undefined)))throw new BadRequestException();
   const result=await this.auth.callback(q.state,browser,q.code,q.error!==undefined);
   if(result.cancelled)return response.redirect(303,`${result.returnPath}?login=cancelled`);
   response.cookie(ACCOUNT_COOKIE,result.token,{...cookieOptions,maxAge:ACCOUNT_SESSION_MS});
   return response.redirect(303,result.returnPath);
  }catch{return response.redirect(303,`${returnPath}?login=failed`);}
 }
 @Post('logout')
 logout(@Req() request:Request,@Res({passthrough:true}) response:Response){
  this.headers(response);assertWebCommand(request,this.origin);assertEmptyCommand(request);
  const result=this.auth.logout(accountCookie(request),accountCookie(request,ACCOUNT_FLOW_COOKIE));
  response.clearCookie(ACCOUNT_COOKIE,cookieOptions);return result;
 }
 @Post('profile')
 profile(@Req() request:Request,@Res({passthrough:true}) response:Response){this.headers(response);assertWebCommand(request,this.origin);return this.auth.profile(accountCookie(request),request.body);}
}
