import {acceptedVotes} from './accepted-votes.js';
import type {Repositories} from './ports/storage.js';
// 표시 순서는 공개 문자열만으로 정한다. 제출 시각/명단/식별자 순서를 사용하지 않는다.
export function publishedRounds(r:Repositories,gameId:string){
  const rounds=[];
  for(const number of [1,2] as const){
    const result=r.settlements.find(gameId,number);
    const round=r.rounds.find(gameId,number);
    if(!result||!round)continue;
    const reasons=acceptedVotes(r,round).votes
      .filter(v=>v.reason.trim().length>0)
      .map(v=>({choice:v.choice,reason:v.reason}));
    reasons.sort((a,b)=>{
      const left=`${a.choice}\u0000${a.reason}`;const right=`${b.choice}\u0000${b.reason}`;
      return left<right?-1:left>right?1:0;
    });
    rounds.push({number,counts:{guilty:result.guilty,notGuilty:result.notGuilty,abstain:result.abstain},reasons});
  }
  return rounds;
}
