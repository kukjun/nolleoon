import type {RedactedGame} from '@trip-court/contracts';
import type {Repositories} from './ports/storage.js';
import {DomainFailure} from '../domain/failure.js';
/** Call only after the existing history authorization check. */
export function legacyRedactedGame(r:Repositories,id:string,kind:RedactedGame['kind']):RedactedGame|null{
 const s=r.accountDeletion.legacySummary(id);if(!s)return null;
 if(kind==='trial'&&r.games.find(id)?.status==='interrupted')return {kind,redacted:true,summary:{participantCount:0}};
 const rounds=s.rounds?.map(x=>{if(x.number!==1&&x.number!==2)throw new DomainFailure('STATE_CONFLICT');return {number:x.number as 1|2,guilty:x.guilty,notGuilty:x.notGuilty,abstain:x.abstain,total:x.total};});
 return {kind,redacted:true,summary:{participantCount:s.participantCount,...(s.teams?{teams:s.teams.map(t=>({team:t.team,count:t.count}))}:{}),...(s.revealed?{revealed:{winnerCount:s.revealed.winnerCount,notWinnerCount:s.revealed.notWinnerCount}}:{}),...(rounds?{rounds}:{})}};
}
