import {Controller,Get,Post,Param,Req,Res,Inject} from '@nestjs/common';
import type {Request,Response} from 'express';
import {AccountAuth} from '../application/account-auth.js';
import {LegacyImports} from '../application/legacy-imports.js';
import {DomainFailure} from '../domain/failure.js';
import {requireAccount} from './account.controller.js';
import {sessionToken,assertWebCommand} from './commands.js';
import {PUBLIC_ORIGIN} from './session.controller.js';
@Controller('account/legacy')
export class LegacyImportsController {
 constructor(@Inject(AccountAuth) private readonly auth:AccountAuth,@Inject(LegacyImports) private readonly legacy:LegacyImports,@Inject(PUBLIC_ORIGIN) private readonly origin:string){}
 private headers(response:Response){response.setHeader('Cache-Control','no-store');}
 @Get('preview')
 preview(@Req() request:Request,@Res({passthrough:true}) response:Response){this.headers(response);if(Object.keys(request.query).some(k=>k!=='cursor'))throw new DomainFailure('INVALID_INPUT');return this.legacy.preview(requireAccount(request,this.auth).accountId,sessionToken(request),request.query.cursor);}
 @Post('import')
 import(@Req() request:Request,@Res({passthrough:true}) response:Response){this.headers(response);assertWebCommand(request,this.origin);return this.legacy.import(requireAccount(request,this.auth).accountId,sessionToken(request),request.body);}
 @Get()
 list(@Req() request:Request,@Res({passthrough:true}) response:Response){this.headers(response);if(Object.keys(request.query).some(k=>k!=='cursor'))throw new DomainFailure('INVALID_INPUT');return this.legacy.list(requireAccount(request,this.auth).accountId,request.query.cursor);}
 @Get(':id')
 detail(@Param('id') id:string,@Req() request:Request,@Res({passthrough:true}) response:Response){this.headers(response);if(Object.keys(request.query).length)throw new DomainFailure('INVALID_INPUT');return this.legacy.detail(requireAccount(request,this.auth).accountId,id);}
}
