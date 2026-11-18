import {Controller,Get,Post,Param,Req,Res,Inject} from '@nestjs/common';
import type {Request,Response} from 'express';
import {TravelRooms} from '../application/travel-rooms.js';
import {TravelRuns} from '../application/travel-runs.js';
import {TravelRoomDeletion} from '../application/travel-room-deletion.js';
import {NativeAccountAuth} from '../application/native-account-auth.js';
import {DomainFailure} from '../domain/failure.js';
import {TravelRoomRoutes} from './travel.controller.js';
import {nativeToken,nativeHeaders,assertNativeCommand,assertNativeTransport} from './native-commands.js';

@Controller('native/travel-rooms')
export class NativeTravelRoomsController extends TravelRoomRoutes {
 constructor(@Inject(TravelRooms) rooms:TravelRooms,@Inject(TravelRoomDeletion) deletion:TravelRoomDeletion,@Inject(TravelRuns) runs:TravelRuns,@Inject(NativeAccountAuth) private readonly auth:NativeAccountAuth){super(rooms,deletion,runs);}
 protected actor(req:Request,res:Response,command=false){nativeHeaders(res);if(command)assertNativeCommand(req);return this.auth.require(nativeToken(req)).accountId;}
}
@Controller('native/travel-invites')
export class NativeTravelInvitesController {
 constructor(@Inject(TravelRooms) private readonly rooms:TravelRooms,@Inject(NativeAccountAuth) private readonly auth:NativeAccountAuth){}
 @Get(':token/preview') preview(@Param('token') token:string,@Req() req:Request,@Res({passthrough:true}) res:Response){nativeHeaders(res);assertNativeTransport(req);return this.rooms.preview(token);}
 @Post(':token/join') join(@Param('token') token:string,@Req() req:Request,@Res({passthrough:true}) res:Response){nativeHeaders(res);assertNativeCommand(req);return this.rooms.join(this.auth.require(nativeToken(req)).accountId,token,req.body);}
}
@Controller('native/travel-deleted-rooms')
export class NativeTravelDeletedRoomsController {
 constructor(@Inject(TravelRoomDeletion) private readonly deletion:TravelRoomDeletion,@Inject(NativeAccountAuth) private readonly auth:NativeAccountAuth){}
 @Get() list(@Req() req:Request,@Res({passthrough:true}) res:Response){nativeHeaders(res);if(Object.keys(req.query).length)throw new DomainFailure('INVALID_INPUT');return this.deletion.list(this.auth.require(nativeToken(req)).accountId);}
}
