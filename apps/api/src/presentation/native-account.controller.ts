import {AccountAuth} from '../application/account-auth.js';
import {AccountDeletion} from '../application/account-deletion.js';
import {Controller,Get,Post,Req,Res,Inject,BadRequestException,ForbiddenException} from '@nestjs/common';
import type {Request,Response} from 'express';
import {NativeAccountAuth} from '../application/native-account-auth.js';
import {nativeToken,nativeHeaders,assertJsonObject,assertNativeTransport,assertNativeCommand} from './native-commands.js';
import {assertEmptyCommand} from './commands.js';
@Controller('native/auth')
export class NativeAuthController {
 constructor(@Inject(NativeAccountAuth) private readonly auth:NativeAccountAuth){}
 @Post('kakao') login(@Req() req:Request,@Res({passthrough:true}) res:Response){nativeHeaders(res);assertNativeTransport(req);if(req.headers.authorization!==undefined)throw new ForbiddenException();assertJsonObject(req);if(Object.keys(req.body).join(',')!=='accessToken')throw new BadRequestException();return this.auth.login(req.body.accessToken);}
 @Post('logout') logout(@Req() req:Request,@Res({passthrough:true}) res:Response){nativeHeaders(res);assertNativeCommand(req);assertEmptyCommand(req);return this.auth.logout(nativeToken(req));}
}
@Controller('native/account')
export class NativeAccountController {
 constructor(@Inject(NativeAccountAuth) private readonly auth:NativeAccountAuth,@Inject(AccountAuth) private readonly profiles:AccountAuth,@Inject(AccountDeletion) private readonly deletion:AccountDeletion){}
 @Post('profile') profile(@Req()req:Request,@Res({passthrough:true})res:Response){nativeHeaders(res);assertNativeCommand(req);return this.profiles.profilePrincipal(this.auth.require(nativeToken(req)),req.body);}
 @Post('delete') remove(@Req()req:Request,@Res({passthrough:true})res:Response){nativeHeaders(res);assertNativeCommand(req);return this.deletion.executeNative(nativeToken(req),req.body);}
 @Get('session') session(@Req() req:Request,@Res({passthrough:true}) res:Response){nativeHeaders(res);return this.auth.session(nativeToken(req));}
}
