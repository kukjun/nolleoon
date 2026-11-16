import type {Repositories,GameRecord,InterruptionRecord} from './ports/storage.js';
import {settleRound} from './round-settlement.js';

export function interruptGame(r:Repositories,game:GameRecord,cause:InterruptionRecord['cause'],at:number){
 if(game.status==='result'||game.status==='interrupted')return;
 const pending=r.rounds.find(game.id,2)??r.rounds.find(game.id,1);
 if(pending&&pending.closedAt==null)r.rounds.close(game.id,pending.number,at);
 // 원인은 최초 전이에만 기록하고 이후 방 종료로 덮어쓰지 않는다.
 r.interruptions.insert({gameId:game.id,cause,interruptedAt:at});
 r.games.update({...game,status:'interrupted',version:game.version+1});
}
export function closeRoom(r:Repositories,roomId:string,at:number,closedByMemberId:string|null){
 const room=r.rooms.find(roomId);if(!room||room.status==='closed')return;
 let game=r.games.active(roomId);
 if(game){
  const round=r.rounds.find(game.id,2)??r.rounds.find(game.id,1);
  if(round&&round.closedAt==null&&round.deadline<=at)settleRound(r,game.id,round.deadline);
  game=r.games.active(roomId);
  if(game)interruptGame(r,game,'room-closed',at);
 }
 r.closures.insert({roomId,closedAt:at,closedByMemberId});
 r.rooms.close(roomId);r.rooms.bumpVersion(roomId);
}
