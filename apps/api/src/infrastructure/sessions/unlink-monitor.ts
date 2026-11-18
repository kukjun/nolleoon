import type {KakaoUnlinkWorker} from '../../application/kakao-unlink-worker.js';
export class UnlinkMonitor {
 private timer:ReturnType<typeof setInterval>|undefined;
 constructor(private readonly worker:KakaoUnlinkWorker|undefined,private readonly enabled=true){}
 onModuleInit(){if(this.enabled&&this.worker){void this.tick();this.timer=setInterval(()=>void this.tick(),60000);this.timer.unref();}}
 private async tick(){try{await this.worker?.sweep();}catch{console.error('kakao_unlink_queue_unavailable');}}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);this.timer=undefined;}
}
