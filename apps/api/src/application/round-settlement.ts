import {acceptedVotes} from './accepted-votes.js';
import {tallyOutcome} from '../domain/tally.js';
import type {Repositories} from './ports/storage.js';

// 투표 저장과 같은 트랜잭션에서 호출하며, 별도 worker도 이 함수를 공유한다.
export function settleRound(r:Repositories,gameId:string,now:number){
  const game=r.games.find(gameId);
  if(!game||game.status!=='voting')return;
  const round=r.rounds.find(gameId,2)??r.rounds.find(gameId,1);
  if(!round||round.closedAt!=null||r.settlements.find(gameId,round.number))return;
  const {electorate,votes}=acceptedVotes(r,round);
  const allSubmitted=votes.length===electorate.size;
  if(!allSubmitted&&now<round.deadline)return;
  const guilty=votes.filter(v=>v.choice==='guilty').length;
  const notGuilty=votes.filter(v=>v.choice==='not-guilty').length;
  const outcome=tallyOutcome(guilty,notGuilty,round.number);
  const result={gameId,roundNumber:round.number,outcome,guilty,notGuilty,
    abstain:electorate.size-guilty-notGuilty,total:electorate.size,
    closedAt:now,closedBy:now>=round.deadline?'deadline' as const:'all-submitted' as const};
  r.settlements.insert(result);
  r.rounds.close(gameId,round.number,now);
  r.games.update({...game,status:outcome==='tie'?'final-defense':'result',version:game.version+1});
  r.rooms.bumpVersion(game.roomId);
  return result;
}
