import type {ReactNode} from 'react';
import type {RoomSnapshot} from '@trip-court/contracts';
import {Button} from './design/components';
import './design/party-layout.css';
export function PartyLobby({room,reconnecting,onPrepare,renderAvatar}:{room:RoomSnapshot;reconnecting:boolean;onPrepare:()=>void;renderAvatar?:(member:RoomSnapshot['members'][number])=>ReactNode}){
 const self=room.members.find(member=>member.memberId===room.self.memberId);
 const others=room.members.filter(member=>member.memberId!==room.self.memberId);
 const featured=self?[self,...others]:others;
 return <section className="party-lobby">
  <span className="eyebrow">OUR LITTLE HANGOUT</span>
  <h2>우리의 대기실</h2><p className="party-greeting">같이 모여서,<br/>오늘도 한 판!</p>
  <div className="party-lobby-meta"><span className="party-chip">우리 방 · {room.members.length}명</span><span className="field-hint">{room.self.isHost?'나 · 방장':'나 · 참가자'}</span></div>
  <div className="party-stage" aria-label="우리 방 캐릭터 무대">
   <span className="party-stage-caption">친구들이 모이는 작은 아지트</span>
   <ul>{featured.slice(0,6).map((member,index)=><li key={member.memberId} className={`party-stage-person person-${index}`}><div className="party-character">{renderAvatar?renderAvatar(member):<span aria-hidden="true">{[...member.nickname][0]}</span>}</div><strong>{member.nickname}{member.memberId===room.self.memberId?' · 나':''}{member.isHost?' ♛':''}</strong><small>{reconnecting?'연결 확인 중':member.connected?'연결됨':'연결 끊김'}</small></li>)}</ul>
   {featured.length>6&&<span className="party-stage-overflow">친구 {featured.length-6}명 더 함께해요</span>}
  </div>
  {!room.self.isHost&&<p className="field-hint">방장이 게임을 준비해요. 내 역할은 직접 선택할 수 있어요.</p>}
  <div className="party-primary"><Button onPress={onPrepare}>{room.self.isHost?'재판 준비하기':'내 역할 준비하기'}</Button></div>
 </section>;
}
