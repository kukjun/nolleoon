import type {RoomSnapshot} from '@trip-court/contracts';
export function mergeRoomSnapshot(previous:RoomSnapshot|null,incoming:RoomSnapshot):RoomSnapshot {
 if(previous&&previous.version>incoming.version)return previous;
 const oldGame=previous?.game;const game=incoming.game;
 if(previous?.self.memberId===incoming.self.memberId&&oldGame&&game
  &&oldGame.gameId===game.gameId&&oldGame.round?.number===game.round?.number
  &&oldGame.ownVote&&oldGame.ownVote.roundNumber===game.round?.number){
  return {...incoming,game:{...game,ownVote:oldGame.ownVote}};
 }
 return incoming;
}
