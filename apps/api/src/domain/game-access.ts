import { DomainFailure } from './failure.js';
export type GamePhase='draft'|'defense'|'voting-1'|'final-defense'|'voting-2'|'result'|'interrupted';
export type GameAction='configure-game'|'select-role'|'accept-penalty'|'start-trial'|'submit-defense'|'start-vote'|'submit-vote'|'close-room';
export type Decision='guilty'|'not-guilty'|'abstain';
export interface GameParticipantView {memberId:string;sessionId:string;role:'defendant'|'participant'|'observer';eligible:boolean;connected:boolean;left:boolean;submittedRounds:number[]}
export interface GameStateView {
 id:string;version:number;phase:GamePhase;caseText:string;penaltyText:string;hostMemberId:string;roomOpen:boolean;deadline:number|null;outcome:'guilty'|'not-guilty'|'no-verdict'|null;
 participants:GameParticipantView[];
 rounds:{number:1|2;closed:boolean;resolution:'tie'|'guilty'|'not-guilty'|'no-verdict'|null;counts:{guilty:number;notGuilty:number;abstain:number};votes:{memberId:string;choice:Decision;reason:string}[]}[];
 interruption?:'room-closed'|'defendant-left';
}
export function gameParticipant(state:GameStateView,actorSessionId:string):GameParticipantView {
 const candidates=state.participants.filter(p=>p.sessionId===actorSessionId);
 const active=candidates.filter(p=>!p.left);
 if(active.length>1)throw new DomainFailure('STATE_CONFLICT');
 const participant=active[0]??candidates[0];
 if(!participant)throw new DomainFailure('FORBIDDEN');
 return participant;
}
// 역할·단계의 필요 조건이다. 개별 명령은 최신 상태에서 인원·수락·deadline 등도 검사해야 한다.
export function gameActions(state:GameStateView,actorSessionId:string):GameAction[] {
 const self=gameParticipant(state,actorSessionId);
 if(self.left||!state.roomOpen||state.phase==='interrupted')return [];
 const host=self.memberId===state.hostMemberId;const actions:GameAction[]=[];
 if(host)actions.push('close-room');
 if(state.phase==='draft') {
  actions.push('select-role');
  if(host)actions.push('configure-game','start-trial');
  if(self.role==='defendant')actions.push('accept-penalty');
 }
 if(state.phase==='defense'||state.phase==='final-defense') {
  if(host)actions.push('start-vote');
  if(self.role==='defendant')actions.push('submit-defense');
 }
 const round=state.phase==='voting-1'?1:state.phase==='voting-2'?2:null;
 if(round && self.role==='participant' && self.eligible && !self.submittedRounds.includes(round))actions.push('submit-vote');
 return actions;
}
export function assertGameAction(state:GameStateView,actorSessionId:string,action:GameAction,expectedVersion?:number):void {
 if(!gameActions(state,actorSessionId).includes(action))throw new DomainFailure('FORBIDDEN');
 if(expectedVersion!==undefined && state.version!==expectedVersion)throw new DomainFailure('STATE_CONFLICT');
}
