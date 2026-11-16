import type { GameSnapshot, PublishedRound } from '@trip-court/contracts';
import { gameActions, gameParticipant, type GameStateView } from '../domain/game-access.js';
// 전체 entity를 직렬화하지 않고 화면별 허용 필드를 명시한다. 아직 게임 endpoint는 없다.
export function presentGame(state:GameStateView,actorSessionId:string):GameSnapshot {
 const self=gameParticipant(state,actorSessionId);
 if(state.phase==='interrupted')return state.interruption==='room-closed'?{phase:'interrupted',caseText:state.caseText,actions:[]}:{phase:'interrupted',actions:[]};
 const published=state.rounds.filter(round=>round.closed && (state.phase==='result' || (round.number===1 && round.resolution==='tie' && ['final-defense','voting-2'].includes(state.phase))));
 const publishedRounds:PublishedRound[]=published.map(round=>({number:round.number,counts:{guilty:round.counts.guilty,notGuilty:round.counts.notGuilty,abstain:round.counts.abstain},reasons:round.votes.filter(v=>v.reason.trim().length>0).map(v=>({choice:v.choice,reason:v.reason})).sort((a,b)=>a.choice.localeCompare(b.choice)||a.reason.localeCompare(b.reason))}));
 const dto:GameSnapshot={gameId:state.id,version:state.version,phase:state.phase,caseText:state.caseText,penaltyText:state.penaltyText,self:{role:self.role,isHost:!self.left&&self.memberId===state.hostMemberId},actions:gameActions(state,actorSessionId),publishedRounds};
 if((state.phase==='voting-1'||state.phase==='voting-2') && state.deadline!==null)dto.deadline=state.deadline;
 if(state.phase==='result' && state.outcome!==null)dto.verdict=state.outcome;
 return dto;
}
