import type {Repositories,RoundRecord} from './ports/storage.js';
// 집계와 이유 공개가 같은 고정 명단/접수 시각 경계를 사용한다.
export function acceptedVotes(r:Repositories,round:RoundRecord){
  const electorate=new Set(r.participants.list(round.gameId).filter(p=>p.eligible&&p.role==='participant').map(p=>p.memberId));
  const votes=r.votes.list(round.gameId,round.number).filter(v=>electorate.has(v.memberId)&&v.submittedAt<round.deadline);
  return {electorate,votes};
}
