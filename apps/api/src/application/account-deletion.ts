import type {UnitOfWork,Repositories} from './ports/storage.js';
import type {Clock,TokenCodec} from './browser-sessions.js';
import {SessionRequired} from './browser-sessions.js';
import {DomainFailure} from '../domain/failure.js';
import {travelInput,requestId} from './travel-rooms.js';
import type {AccountDeletionEntry,DeletionLedger,RedactedRunSummary} from './ports/account-deletion.js';
import type {TravelRun} from './ports/travel.js';
function number(value:unknown):number{return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:0;}
function object(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function array(value:unknown):unknown[]{return Array.isArray(value)?value:[];}
export function summarizeDeletedRun(run:TravelRun,participantCount:number):RedactedRunSummary {
 let s:Record<string,unknown>={};try{s=object(JSON.parse(run.stateJson));}catch{/* No raw fallback, ever. */}
 const summary:RedactedRunSummary={participantCount:number(participantCount)};
 if(run.type==='trial')summary.rounds=array(s.rounds).map(v=>{const r=object(v),c=object(r.counts);return{number:number(r.number),guilty:number(c.guilty),notGuilty:number(c.notGuilty),abstain:number(c.abstain),total:number(c.guilty)+number(c.notGuilty)+number(c.abstain)};}).filter(r=>r.number===1||r.number===2);
 if(run.type==='team'){const sizes=new Map<number,number>();for(const a of array(s.assignments)){const team=number(object(a).team);if(team>0)sizes.set(team,(sizes.get(team)??0)+1);}summary.teams=[...sizes].sort((a,b)=>a[0]-b[0]).map(([team,count])=>({team,count}));}
 if(run.type==='draw'){const revealed=new Set(array(s.revealedIds).filter(v=>typeof v==='string'));const wins=array(s.allocations).filter(v=>{const a=object(v);return revealed.has(a.memberId as string)&&a.winning===true;}).length;summary.revealed={winnerCount:wins,notWinnerCount:revealed.size-wins};}
 if(run.type==='menu')summary.responseCount=array(s.responses).length;
 return summary;
}
/** Used by live deletion and verified-ledger replay on a private restore copy. */
export function applyAccountDeletion(r:Repositories,entry:AccountDeletionEntry,options:{restore?:boolean}={}):void {
 for(const id of entry.runIds){const run=r.travel.run(id);if(!run)continue;const existing=r.accountDeletion.summary(id);const count=r.travel.participants(id).length;r.accountDeletion.redactRun(id,existing??summarizeDeletedRun(run,count));}
 // Legacy scrub is a separately reviewed adapter, bounded by authoritative explicit run IDs.
 r.accountDeletion.redactLegacy(entry,options.restore===true);
 r.accountDeletion.scrubIdentity(entry);
}
export class AccountDeletion {
 constructor(private readonly uow:UnitOfWork,private readonly clock:Clock,private readonly codec:TokenCodec,private readonly ledger?:DeletionLedger){}
 reconcile(){if(!this.ledger)return;for(const entry of this.ledger.entries())this.uow.run(r=>{if(!r.accountDeletion.deletion(entry.accountId))applyAccountDeletion(r,entry);});}
 execute(token:unknown,input:unknown){const b=travelInput(input,['requestId','confirmation']),requestKey=requestId(b.requestId);if(b.confirmation!=='계정 탈퇴')throw new DomainFailure('INVALID_INPUT');if(typeof token!=='string'||!/^[-A-Za-z0-9_]{43}$/.test(token))throw new SessionRequired();if(!this.ledger)throw new DomainFailure('TEMPORARILY_UNAVAILABLE');return this.uow.run(r=>{
 const sessionHash=this.codec.hash(token),now=this.clock.now(),retry=r.accountDeletion.retry(sessionHash,now);if(retry){if(retry.operationId!==this.codec.hash(retry.accountId+':'+requestKey))throw new SessionRequired();return{deleted:true};}const session=r.accountAuth.findSession(sessionHash);if(!session||session.revokedAt!==null||session.expiresAt<=now)throw new SessionRequired();const a=r.accountAuth.findAccount(session.accountId);if(a?.status!=='active')throw new SessionRequired();if(r.accountDeletion.blocked(a.id))throw new DomainFailure('STATE_CONFLICT');
 const entry:AccountDeletionEntry={operationId:this.codec.hash(a.id+':'+requestKey),accountId:a.id,runIds:r.accountDeletion.affectedRuns(a.id).map(run=>run.id).sort(),legacyRunIds:r.accountDeletion.linkedRuns(a.id).sort(),legacyProofs:r.accountDeletion.legacyProofs(a.id),createdAt:now};
 const canonical=this.ledger!.record(entry);applyAccountDeletion(r,canonical);return{deleted:true};
 });}
}
