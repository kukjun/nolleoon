import type {RandomSource} from './ports/random.js';
import {assignVacantHost} from './host-transfer.js';
import type {Repositories,MemberRecord,UnitOfWork} from './ports/storage.js';
import {settleRound} from './round-settlement.js';
export const DISCONNECT_GRACE_MS = 600000;

// 호출자가 같은 트랜잭션에서 소유권/현재 멤버십을 확인한 뒤 호출한다.
export function leaveMember(r:Repositories, member:MemberRecord, effectiveAt:number) {
 const room=r.rooms.find(member.roomId);
 if(!room||!r.members.active(room.id).some(m=>m.id===member.id))return;
 let game=r.games.active(room.id);
 if(game){
  const round=r.rounds.find(game.id,2)??r.rounds.find(game.id,1);
  // 동일 시각에는 이미 마감한 투표를 먼저 확정한다.
  if(round&&round.closedAt==null&&round.deadline<=effectiveAt)settleRound(r,game.id,round.deadline);
  game=r.games.active(room.id);
  if(game&&r.participants.list(game.id).some(p=>p.memberId===member.id&&p.role==='defendant')){
   const pending=r.rounds.find(game.id,2)??r.rounds.find(game.id,1);
   if(pending&&pending.closedAt==null)r.rounds.close(game.id,pending.number,effectiveAt);
   r.games.update({...game,status:'interrupted',version:game.version+1});
  }
 }
 r.members.exclude(member.id,effectiveAt);
 if(room.hostMemberId===member.id)r.rooms.setHost(room.id,null);
 if(member.role==='defendant')r.rooms.bumpRoleRevision(room.id);
 r.rooms.bumpVersion(room.id);
}

// 두 monitor와 모든 요청 경계에서 동일하게 시간순으로 재생한다.
export function maintainRooms(r:Repositories, now:number,random:RandomSource){
 let settled=0,expired=0;
 for(const room of r.rooms.open()){
  const due=r.members.active(room.id)
   .filter(m=>m.disconnectedAt!=null&&m.disconnectedAt+DISCONNECT_GRACE_MS<=now)
   .sort((a,b)=>(a.disconnectedAt!-b.disconnectedAt!)||a.id.localeCompare(b.id));
  for(const member of due){leaveMember(r,member,member.disconnectedAt!+DISCONNECT_GRACE_MS);expired++;}
  const game=r.games.active(room.id);
  if(game&&settleRound(r,game.id,now))settled++;
 }
 for(const roomId of r.members.detectDisconnected(now,15000))r.rooms.bumpVersion(roomId);
 for(const room of r.rooms.open())assignVacantHost(r,room.id,now,random);
 return {settled,expired};
}
// 실패하는 명령의 rollback이 이미 효력이 발생한 만료를 되돌리지 않게 먼저 커밋한다.
export function maintainBeforeRequest(uow:UnitOfWork,now:number,random:RandomSource){uow.run(r=>maintainRooms(r,now,random));}
