import type {TravelRoomDeletion} from '../../application/travel-room-deletion.js';
export const ROOM_DELETION_SWEEP_MS=60000;
export class RoomDeletionMonitor {
 private timer:ReturnType<typeof setInterval>|undefined;
 constructor(private readonly deletion:Pick<TravelRoomDeletion,'sweep'>,private readonly enabled=true){}
 onModuleInit(){if(this.enabled){this.tick();this.timer=setInterval(()=>this.tick(),ROOM_DELETION_SWEEP_MS);this.timer.unref();}}
 private tick(){try{this.deletion.sweep();}catch{console.error('room_deletion_failed');}}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);this.timer=undefined;}
}
