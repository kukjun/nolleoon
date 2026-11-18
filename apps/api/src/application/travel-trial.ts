import {DomainFailure} from '../domain/failure.js';
import {tallyOutcome,type TallyOutcome} from '../domain/tally.js';
import {validateSettings} from './rooms.js';
type Choice='guilty'|'not-guilty'|'abstain';
type Phase='preparing'|'defense'|'voting'|'first-result'|'final-defense'|'completed';
type Vote={membershipId:string;choice:Choice;reason:string};
type Defense={number:1|2;status:'submitted'|'skipped';text:string};
type PublishedRound={number:1|2;counts:{guilty:number;notGuilty:number;abstain:number};reasons:{choice:Choice;reason:string}[]};
export interface TravelTrialState {phase:Phase;caseText:string;penaltyText:string;durationSeconds:number;defendantMembershipId:string;consent:'pending'|'accepted'|'rejected';roundNumber:1|2;deadline:number|null;votes:Vote[];defenses:Defense[];rounds:PublishedRound[];outcome:TallyOutcome|null;participants:string[]}
export interface TrialContext {actor:string;facilitator:string;participants:string[];now:number}
function fail(code:'INVALID_INPUT'|'FORBIDDEN'|'STATE_CONFLICT'):never{throw new DomainFailure(code);}
function record(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))fail('INVALID_INPUT');return value as Record<string,unknown>;}
function exact(body:Record<string,unknown>,keys:string[]){if(Object.keys(body).sort().join(',')!==keys.sort().join(','))fail('INVALID_INPUT');}
export function prepareTrial(input:unknown,participants:string[]):TravelTrialState{
 const b=record(input);exact(b,['caseText','penaltyText','durationMinutes','defendantMembershipId']);
 const v=validateSettings({expectedVersion:0,caseText:b.caseText,penaltyText:b.penaltyText,durationMinutes:b.durationMinutes});
 if(!v.caseText||!v.penaltyText||participants.length<3||new Set(participants).size!==participants.length||typeof b.defendantMembershipId!=='string'||!participants.includes(b.defendantMembershipId))fail('INVALID_INPUT');
 return {phase:'preparing',caseText:v.caseText,penaltyText:v.penaltyText,durationSeconds:v.durationMinutes*60,defendantMembershipId:b.defendantMembershipId,consent:'pending',roundNumber:1,deadline:null,votes:[],defenses:[],rounds:[],outcome:null,participants:[...participants]};
}
function settle(s:TravelTrialState):TravelTrialState{
 const count=s.participants.length-1,guilty=s.votes.filter(v=>v.choice==='guilty').length,notGuilty=s.votes.filter(v=>v.choice==='not-guilty').length;
 const reasons=s.votes.filter(v=>v.reason.trim()).map(({choice,reason})=>({choice,reason})).sort((a,b)=>{const x=a.choice+'\0'+a.reason,y=b.choice+'\0'+b.reason;return x<y?-1:x>y?1:0;});
 s.outcome=tallyOutcome(guilty,notGuilty,s.roundNumber);s.rounds.push({number:s.roundNumber,counts:{guilty,notGuilty,abstain:count-guilty-notGuilty},reasons});s.phase=s.outcome==='tie'?'first-result':'completed';s.deadline=null;return s;
}
export function maintainTrial(state:TravelTrialState,now:number):TravelTrialState{
 const s=structuredClone(state);if(s.phase==='voting'&&s.deadline!==null&&now>=s.deadline)return settle(s);return s;
}
export function actOnTrial(state:TravelTrialState,input:unknown,ctx:TrialContext):TravelTrialState{
 const b=record(input),s=maintainTrial(state,ctx.now);
 const participating=s.participants.includes(ctx.actor)&&ctx.participants.includes(ctx.actor);
 if(!participating&&ctx.actor!==ctx.facilitator)fail('FORBIDDEN');
 if(b.action==='consent'){
  exact(b,['action','decision']);if(!participating||ctx.actor!==s.defendantMembershipId)fail('FORBIDDEN');if(s.phase!=='preparing')fail('STATE_CONFLICT');if(b.decision!=='accepted'&&b.decision!=='rejected')fail('INVALID_INPUT');s.consent=b.decision;return s;
 }
 if(b.action==='defense'){
  exact(b,['action','decision','text']);if(!participating||ctx.actor!==s.defendantMembershipId)fail('FORBIDDEN');
  if(s.phase!=='defense'&&s.phase!=='final-defense')fail('STATE_CONFLICT');
  if((b.decision!=='submit'&&b.decision!=='skip')||typeof b.text!=='string'||[...b.text].length>5000||/[\p{Cc}\p{Cf}]/u.test(b.text.replace(/[\n\r\t]/g,''))||(b.decision==='submit'&&!b.text.trim())||(b.decision==='skip'&&b.text!==''))fail('INVALID_INPUT');
  const number=s.phase==='defense'?1:2;s.defenses=s.defenses.filter(d=>d.number!==number);s.defenses.push({number,status:b.decision==='submit'?'submitted':'skipped',text:(b.text as string).trim()});return s;
 }
 if(b.action==='vote'){
  exact(b,['action','choice','reason']);if(!participating||ctx.actor===s.defendantMembershipId)fail('FORBIDDEN');if(s.phase!=='voting'||s.votes.some(v=>v.membershipId===ctx.actor))fail('STATE_CONFLICT');
  if(typeof b.choice!=='string'||!['guilty','not-guilty','abstain'].includes(b.choice)||typeof b.reason!=='string'||(b.choice!=='abstain'&&!b.reason.trim())||[...b.reason].length>2000||/[\p{Cc}\p{Cf}]/u.test(b.reason.replace(/[\n\r\t]/g,'')))fail('INVALID_INPUT');
  s.votes.push({membershipId:ctx.actor,choice:b.choice as Choice,reason:(b.reason as string).trim()});return s.votes.length===s.participants.length-1?settle(s):s;
 }
 if(b.action==='duration'){
  exact(b,['action','durationMinutes']);if(ctx.actor!==ctx.facilitator)fail('FORBIDDEN');if(s.phase!=='defense')fail('STATE_CONFLICT');
  if(!Number.isInteger(b.durationMinutes)||Number(b.durationMinutes)<1||Number(b.durationMinutes)>10)fail('INVALID_INPUT');s.durationSeconds=Number(b.durationMinutes)*60;return s;
 }
 exact(b,['action']);if(ctx.actor!==ctx.facilitator)fail('FORBIDDEN');
 if(b.action==='start'){if(s.phase!=='preparing'||s.consent!=='accepted')fail('STATE_CONFLICT');s.phase='defense';return s;}
 if(b.action==='final-defense'){if(s.phase!=='first-result')fail('STATE_CONFLICT');s.phase='final-defense';return s;}
 if(b.action==='begin-vote'){if(s.phase!=='defense'&&s.phase!=='final-defense')fail('STATE_CONFLICT');s.roundNumber=s.phase==='defense'?1:2;s.phase='voting';s.votes=[];s.deadline=ctx.now+s.durationSeconds*1000;return s;}
 return fail('INVALID_INPUT');
}
export function projectTrial(state:TravelTrialState,actor:string,currentParticipants:string[]){
 if(!state.participants.includes(actor)||!currentParticipants.includes(actor))fail('FORBIDDEN');
 return {phase:state.phase,caseText:state.caseText,penaltyText:state.penaltyText,durationSeconds:state.durationSeconds,defendantMembershipId:state.defendantMembershipId,consent:state.consent,roundNumber:state.roundNumber,deadline:state.deadline,submittedCount:state.votes.length,self:{voted:state.votes.some(v=>v.membershipId===actor),vote:(()=>{const own=state.votes.find(v=>v.membershipId===actor);return own?{choice:own.choice,reason:own.reason}:null;})(),isDefendant:actor===state.defendantMembershipId},defenses:structuredClone(state.defenses),rounds:structuredClone(state.rounds),outcome:state.outcome};
}
