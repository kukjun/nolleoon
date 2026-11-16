import {test} from 'node:test';import assert from 'node:assert/strict';
import {mergeRoomSnapshot} from '../../apps/web/src/api/room-merge.ts';
test('동일 버전의 늦은 응답은 접수된 자기 투표를 지우지 않고 새 멤버·라운드는 승계하지 않는다',()=>{
 const receipt={roundNumber:1,choice:'guilty',reason:'이유'};const room={version:4,self:{memberId:'one'},game:{gameId:'g',round:{number:1},ownVote:receipt}};
 assert.equal(mergeRoomSnapshot(room,{...room,game:{...room.game,ownVote:null}}).game.ownVote,receipt);
 assert.equal(mergeRoomSnapshot(room,{...room,self:{memberId:'two'},game:{...room.game,ownVote:null}}).game.ownVote,null);
 assert.equal(mergeRoomSnapshot(room,{...room,game:{...room.game,round:{number:2},ownVote:null}}).game.ownVote,null);
 assert.equal(mergeRoomSnapshot(room,{...room,version:3}).version,4);
});
