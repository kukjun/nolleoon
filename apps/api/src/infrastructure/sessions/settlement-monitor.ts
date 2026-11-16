import type {SettleRounds} from '../../application/settle-round.js';
export const SETTLEMENT_SWEEP_MS=1000;
export class SettlementMonitor {
 private timer:ReturnType<typeof setInterval>|undefined;
 constructor(private readonly rounds:SettleRounds,private readonly enabled=true){}
 onModuleInit(){if(this.enabled){this.tick();this.timer=setInterval(()=>this.tick(),SETTLEMENT_SWEEP_MS);this.timer.unref();}}
 private tick(){try{this.rounds.sweep();}catch{console.error('round_settlement_failed');}}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);this.timer=undefined;}
}
