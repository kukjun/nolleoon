/** Travel-only policy. Call before reveal inside the same serialized transaction. */
export const TRAVEL_LOT_GRACE_MS=600_000;
export type TravelLotStatus='active'|'completed'|'incomplete';
export interface TravelLotParticipant {memberId:string;revealed:boolean;disconnectedAt:number|null;departure:'none'|'explicit'|'expelled'}
export interface TravelLotDecision {status:TravelLotStatus;endedAt:number|null;blockedPolicy:null|'departure-policy-unresolved'}
export function evaluateTravelLottery(status:TravelLotStatus,participants:readonly TravelLotParticipant[],now:number):TravelLotDecision {
 if(!Number.isFinite(now))throw new Error('Invalid time');
 if(status!=='active')return {status,endedAt:null,blockedPolicy:null};
 if(participants.some(p=>!p.revealed&&p.departure!=='none'))return {status,endedAt:null,blockedPolicy:'departure-policy-unresolved'};
 const due=participants.filter(p=>!p.revealed&&p.disconnectedAt!==null&&p.disconnectedAt+TRAVEL_LOT_GRACE_MS<=now).map(p=>p.disconnectedAt!+TRAVEL_LOT_GRACE_MS);
 return due.length?{status:'incomplete',endedAt:Math.min(...due),blockedPolicy:null}:{status,endedAt:null,blockedPolicy:null};
}
export function canRevealTravelLot(status:TravelLotStatus,participants:readonly TravelLotParticipant[],memberId:string,now:number):boolean {
 const decision=evaluateTravelLottery(status,participants,now);
 return decision.status==='active'&&decision.blockedPolicy===null&&participants.some(p=>p.memberId===memberId&&!p.revealed&&p.departure==='none');
}
/** Accept only persisted public reveal IDs; never serialize allocation rows directly. */
export function publicTravelLotResults(allocations:readonly {memberId:string;winning:boolean}[],revealedIds:readonly string[]):{memberId:string;winner:boolean}[]{
 const publicIds=new Set(revealedIds);
 return allocations.filter(a=>publicIds.has(a.memberId)).map(a=>({memberId:a.memberId,winner:a.winning}));
}
