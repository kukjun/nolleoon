import {actOnTrial,maintainTrial,prepareTrial,projectTrial,type TravelTrialState} from './travel-trial.js';
import type {TravelGameContext,TravelGameEngine,TravelTransition} from './ports/travel-engine.js';
function state(value:unknown):TravelTrialState{return value as TravelTrialState;}
function context(c:TravelGameContext){return {actor:c.actorMembershipId,facilitator:c.facilitatorMembershipId,participants:c.participantIds,now:c.now};}
function transition(s:TravelTrialState):TravelTransition{return {status:s.phase==='preparing'?'draft':s.phase==='completed'?'completed':'active',state:s,result:null};}
export class TravelTrialEngine implements TravelGameEngine {
 readonly type='trial' as const;
 prepare(settings:unknown,c:TravelGameContext){return {settings,state:prepareTrial(settings,c.participantIds)};}
 start(_settings:unknown,value:unknown,c:TravelGameContext){return transition(actOnTrial(state(value),{action:'start'},context(c)));}
 action(_settings:unknown,value:unknown,command:unknown,c:TravelGameContext){return transition(actOnTrial(state(value),command,context(c)));}
 maintain(_settings:unknown,value:unknown,c:TravelGameContext){
  if(c.status!=='active')return null;const before=state(value),after=maintainTrial(before,c.now);
  return JSON.stringify(before)===JSON.stringify(after)?null:transition(after);
 }
 project(_settings:unknown,value:unknown,_result:unknown,c:TravelGameContext){
  const s=state(value);
  // Management is not permission to read the case, defense, votes, or judgment.
  if(!c.participantIds.includes(c.actorMembershipId))return {kind:'trial',restricted:true,phase:c.actorMembershipId===c.facilitatorMembershipId?s.phase:null};
  if(c.status==='interrupted'||c.status==='incomplete')return {kind:'trial',restricted:false,phase:'interrupted'};
  return {kind:'trial',restricted:false,...projectTrial(s,c.actorMembershipId,c.participantIds)};
 }
}
