import {Controller,Get,Param,Req,Res,Inject} from '@nestjs/common';
import type {Request,Response} from 'express';
import {LegacyImports} from '../application/legacy-imports.js';
import {NativeAccountAuth} from '../application/native-account-auth.js';
import {DomainFailure} from '../domain/failure.js';
import {nativeToken,nativeHeaders} from './native-commands.js';
/** Already-linked account history only. No anonymous-cookie proof or import endpoint on native. */
@Controller('native/account/legacy')
export class NativeLegacyController {
 constructor(@Inject(LegacyImports) private readonly legacy:LegacyImports,@Inject(NativeAccountAuth) private readonly auth:NativeAccountAuth){}
 @Get() list(@Req()req:Request,@Res({passthrough:true})res:Response){nativeHeaders(res);if(Object.keys(req.query).some(k=>k!=='cursor'))throw new DomainFailure('INVALID_INPUT');return this.legacy.list(this.auth.require(nativeToken(req)).accountId,req.query.cursor);}
 @Get(':id') detail(@Param('id')id:string,@Req()req:Request,@Res({passthrough:true})res:Response){nativeHeaders(res);if(Object.keys(req.query).length)throw new DomainFailure('INVALID_INPUT');return this.legacy.detail(this.auth.require(nativeToken(req)).accountId,id);}
}
