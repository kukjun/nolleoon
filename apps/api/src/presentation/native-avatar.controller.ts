import {Controller,Inject} from '@nestjs/common';
import type {Request} from 'express';
import {AccountAvatars} from '../application/account-avatars.js';
import {NativeAccountAuth} from '../application/native-account-auth.js';
import {AccountAvatarRoutes} from './account-avatar.controller.js';
import {nativeToken,assertNativeCommand} from './native-commands.js';
@Controller('native')
export class NativeAvatarController extends AccountAvatarRoutes {
 constructor(@Inject(AccountAvatars) avatars:AccountAvatars,@Inject(NativeAccountAuth) private readonly auth:NativeAccountAuth){super(avatars);}
 protected actor(req:Request){return this.auth.require(nativeToken(req));}
 protected command(req:Request,binary=false){if(binary)nativeToken(req);else assertNativeCommand(req);}
}
