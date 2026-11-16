import type {Repositories} from './ports/storage.js';
import type {RandomSource} from './ports/random.js';

// 외부 요청/난수 결과로 방장을 지정하지 않는다. 반드시 쓰기 transaction 내부에서 호출한다.
export function assignVacantHost(r:Repositories,roomId:string,now:number,random:RandomSource){
 const room=r.rooms.find(roomId);
 if(!room||room.status!=='open'||room.hostMemberId!=null)return false;
 const candidates=r.members.active(roomId).filter(member=>
  member.disconnectedAt==null&&(member.lastSeenAt??member.joinedAt)>now-15000);
 if(!candidates.length)return false;
 const index=random.nextInt(candidates.length);
 if(!Number.isInteger(index)||index<0||index>=candidates.length)throw new Error('난수 제공자의 후보 인덱스가 유효하지 않습니다.');
 r.rooms.setHost(roomId,candidates[index]!.id);
 r.rooms.bumpVersion(roomId);
 return true;
}
