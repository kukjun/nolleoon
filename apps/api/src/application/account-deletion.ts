import {applyRoomDeletionEvent,ROOM_DELETION_GRACE_MS} from './travel-room-deletion.js';
import type {UnitOfWork,Repositories} from './ports/storage.js';
import type {Clock,TokenCodec} from './browser-sessions.js';
import {SessionRequired} from './browser-sessions.js';
import {DomainFailure} from '../domain/failure.js';
import {travelInput,requestId} from './travel-rooms.js';
import type {AccountDeletionEntry,DeletionLedger,RedactedRunSummary} from './ports/account-deletion.js';
import type {TravelRun} from './ports/travel.js';
function invalid():never{throw new DomainFailure('STATE_CONFLICT');}
function integer(value:unknown):number{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)invalid();return value;}
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))invalid();return value as Record<string,unknown>;}
function array(value:unknown):unknown[]{if(!Array.isArray(value))invalid();return value;}
function ids(values:unknown[]):string[]{if(values.some(v=>typeof v!=='string'||!v)||new Set(values).size!==values.length)invalid();return values as string[];}
export function summarizeDeletedRun(run:TravelRun,participantCount:number):RedactedRunSummary {
 let state:Record<string,unknown>;
 try{state=object(JSON.parse(run.stateJson));}catch{invalid();}
 const summary:RedactedRunSummary={participantCount:integer(participantCount)};
 const completed=run.status==='completed';
 if(completed&&participantCount<(run.type==='trial'?3:2))invalid();
 if(run.type==='trial'){
  const rounds=array(state.rounds);
  if(completed&&rounds.length===0)invalid();
  summary.rounds=rounds.map((value,index)=>{
   const round=object(value),counts=object(round.counts),number=integer(round.number);
   const guilty=integer(counts.guilty),notGuilty=integer(counts.notGuilty),abstain=integer(counts.abstain);
   const total=guilty+notGuilty+abstain;
   // Only published rounds are summarized. Missing deadline votes already count as
   // abstentions; the defendant never joins the frozen electorate.
   if(number!==index+1||number>2||participantCount<3||!Number.isSafeInteger(total)||total!==participantCount-1)invalid();
   return{number,guilty,notGuilty,abstain,total};
  });
 }
 if(run.type==='team'){
  const assignments=array(state.assignments).map(object);
  ids(assignments.map(a=>a.membershipId));
  if(assignments.length>participantCount||(completed&&assignments.length!==participantCount))invalid();
  const sizes=new Map<number,number>();
  for(const assignment of assignments){const team=integer(assignment.team);if(team===0||team>participantCount)invalid();sizes.set(team,(sizes.get(team)??0)+1);}
  summary.teams=[...sizes].sort((a,b)=>a[0]-b[0]).map(([team,count])=>({team,count}));
 }
 if(run.type==='draw'){
  const allocations=array(state.allocations).map(object),allocated=ids(allocations.map(a=>a.memberId));
  const revealed=new Set(ids(array(state.revealedIds)));
  if(allocated.length>participantCount||allocations.some(a=>typeof a.winning!=='boolean')||[...revealed].some(id=>!allocated.includes(id)))invalid();
  if(completed&&(allocated.length!==participantCount||revealed.size!==participantCount))invalid();
  const wins=allocations.filter(a=>revealed.has(a.memberId as string)&&a.winning===true).length;
  summary.revealed={winnerCount:wins,notWinnerCount:revealed.size-wins};
 }
 if(run.type==='menu'){
  const responses=state.phase==='draft'&&state.responses===undefined?[]:array(state.responses).map(object);
  ids(responses.map(a=>a.participantId));
  if(responses.length>participantCount||(completed&&responses.length!==participantCount))invalid();
  summary.responseCount=responses.length;
 }
 return summary;
}
/** Used by live deletion and verified-ledger replay on a private restore copy. */
export function applyAccountDeletion(r:Repositories,entry:AccountDeletionEntry,options:{restore?:boolean}={}):void {
 for(const id of entry.runIds){const run=r.travel.run(id);if(!run)continue;const existing=r.accountDeletion.summary(id);const count=r.travel.participants(id).length;r.accountDeletion.redactRun(id,existing??summarizeDeletedRun(run,count));}
 // Legacy scrub is a separately reviewed adapter, bounded by authoritative explicit run IDs.
 r.accountDeletion.redactLegacy(entry,options.restore===true);
 for(const pending of entry.roomDeletions??[])applyRoomDeletionEvent(r,{...pending,operationId:entry.operationId+':room:'+pending.roomId,action:'delete',at:entry.createdAt});
 r.accountDeletion.scrubIdentity(entry);
}
export class AccountDeletion {
 constructor(private readonly uow:UnitOfWork,private readonly clock:Clock,private readonly codec:TokenCodec,private readonly ledger?:DeletionLedger){}
 reconcile(){if(!this.ledger)return;for(const entry of this.ledger.entries())this.uow.run(r=>{if(!r.accountDeletion.deletion(entry.accountId))applyAccountDeletion(r,entry);});}
 execute(token:unknown,input:unknown){const b=travelInput(input,['requestId','confirmation']),requestKey=requestId(b.requestId);if(b.confirmation!=='계정 탈퇴')throw new DomainFailure('INVALID_INPUT');if(typeof token!=='string'||!/^[-A-Za-z0-9_]{43}$/.test(token))throw new SessionRequired();if(!this.ledger)throw new DomainFailure('TEMPORARILY_UNAVAILABLE');this.reconcile();return this.uow.run(r=>{
 const sessionHash=this.codec.hash(token),now=this.clock.now(),retry=r.accountDeletion.retry(sessionHash,now);if(retry){if(retry.operationId!==this.codec.hash(retry.accountId+':'+requestKey))throw new SessionRequired();return{deleted:true};}const session=r.accountAuth.findSession(sessionHash);if(!session||session.revokedAt!==null||session.expiresAt<=now)throw new SessionRequired();const a=r.accountAuth.findAccount(session.accountId);if(a?.status!=='active')throw new SessionRequired();if(r.accountDeletion.blocked(a.id))throw new DomainFailure('STATE_CONFLICT');
 const affected=r.accountDeletion.affectedRuns(a.id);for(const run of affected)if(!r.accountDeletion.summary(run.id))summarizeDeletedRun(run,r.travel.participants(run.id).length);
 const entry:AccountDeletionEntry={operationId:this.codec.hash(a.id+':'+requestKey),accountId:a.id,runIds:affected.map(run=>run.id).sort(),legacyRunIds:r.accountDeletion.linkedRuns(a.id).sort(),legacyProofs:r.accountDeletion.legacyProofs(a.id),createdAt:now};
 const rooms=r.accountDeletion.soloRooms(a.id);if(rooms.length)entry.roomDeletions=rooms.map(room=>({roomId:room.id,deletedAt:now,purgeAfter:now+ROOM_DELETION_GRACE_MS,deletionVersion:room.version+1,previousStatus:room.status,administratorAccountId:a.id}));
 const canonical=this.ledger!.record(entry);applyAccountDeletion(r,canonical);return{deleted:true};
 });}
}
