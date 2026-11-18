import {Controller,Post,Req,Res,Inject} from '@nestjs/common';
import type {Request,Response} from 'express';
import {AccountDeletion} from '../application/account-deletion.js';
import {accountCookie,ACCOUNT_COOKIE,ACCOUNT_FLOW_COOKIE} from './account.controller.js';
import {assertWebCommand} from './commands.js';
import {PUBLIC_ORIGIN} from './session.controller.js';
@Controller('account')
export class AccountDeletionController {
 constructor(@Inject(AccountDeletion) private readonly deletion:AccountDeletion,@Inject(PUBLIC_ORIGIN) private readonly origin:string){}
 @Post('delete')
 remove(@Req() request:Request,@Res({passthrough:true}) response:Response){response.setHeader('Cache-Control','no-store');response.setHeader('Referrer-Policy','no-referrer');assertWebCommand(request,this.origin);const result=this.deletion.execute(accountCookie(request),request.body);for(const name of [ACCOUNT_COOKIE,ACCOUNT_FLOW_COOKIE])response.clearCookie(name,{secure:true,httpOnly:true,sameSite:name===ACCOUNT_FLOW_COOKIE?'lax':'strict',path:'/'});return result;}
}
