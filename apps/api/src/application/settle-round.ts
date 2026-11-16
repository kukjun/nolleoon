import type {RandomSource} from './ports/random.js';
import {maintainRooms} from './membership-lifecycle.js';
import type {UnitOfWork} from './ports/storage.js';
import type {Clock} from './browser-sessions.js';
export {settleRound} from './round-settlement.js';
export class SettleRounds {
 constructor(private readonly uow:UnitOfWork,private readonly clock:Clock,private readonly random:RandomSource){}
 sweep(){return this.uow.run(r=>maintainRooms(r,this.clock.now(),this.random).settled);}
}
