import type {Rooms} from '../../application/rooms.js';
export const PRESENCE_SWEEP_MS=1000;
// 참가자의 요청이 없어도 실행한다. 종료 시 timer를 해제한다.
export class PresenceMonitor {
 private timer:ReturnType<typeof setInterval>|undefined;
 constructor(private readonly rooms:Rooms,private readonly enabled=true){}
 onModuleInit(){if(this.enabled){this.tick();this.timer=setInterval(()=>this.tick(),PRESENCE_SWEEP_MS);this.timer.unref();}}
 private tick(){try{this.rooms.sweep();}catch{console.error('presence_sweep_failed');}}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);this.timer=undefined;}
}
