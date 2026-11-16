import {useEffect,useRef,useState} from 'react';
import type {RoomSnapshot} from '@trip-court/contracts';
import {Button,Input,Status} from './design/components';
import {identityLoss} from './api/identity-generation';
import {NextGame} from './next-game';
import {PreviousGame} from './previous-game';
import {CloseRoom} from './close-room';
import {LeaveRoom} from './leave-room';
import {ResultView} from './result-view';
import {mergeRoomSnapshot} from './api/room-merge';
import {TrialControls} from './trial-controls';
import {GameStart,StartedGame} from './game-start';
import {PenaltyConsent} from './penalty-consent';
import {RoomRoles} from './room-roles';
import {GameSettings} from './game-settings';
import {SnapshotOrder} from './api/snapshot-order';
import {requestRoom} from './api/rooms-client';
export function Rooms({onJoined,onIdentityLost}:{onJoined?:(joined:boolean)=>void;onIdentityLost:()=>void}){
 useEffect(()=>identityLoss.subscribe(onIdentityLost),[onIdentityLost]);
 const code=new URL(location.href).searchParams.get('room');
 const [room,setRoom]=useState<RoomSnapshot|null>(null);const [nickname,setNickname]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(Boolean(code));const [copied,setCopied]=useState(false);const [missing,setMissing]=useState(false);
 const [left,setLeft]=useState(false);const currentMember=useRef<string|null>(null);currentMember.current=room?.self.memberId??null;
 const [reconnecting,setReconnecting]=useState(false);const [excluded,setExcluded]=useState(false);
 const latestVersion=useRef(0);if(room)latestVersion.current=Math.max(latestVersion.current,room.version);
 const pollNow=useRef<()=>Promise<void>>(async()=>{});
 const submitting=useRef(false);
 useEffect(()=>{onJoined?.(Boolean(room)||left);},[Boolean(room),left,onJoined]);
 const generation=useRef(0);const controller=useRef<AbortController|null>(null);
 useEffect(()=>{let alive=true;const abort=new AbortController();controller.current=abort;const current=++generation.current;
  if(code&&!room)void requestRoom(code,undefined,abort.signal).then(result=>{if(!alive||current!==generation.current)return;setLoading(false);if(result.ok)setRoom(result.data);else if(result.code!=='FORBIDDEN'){setError(result.message);setMissing(result.code==='NOT_FOUND'||result.code==='ROOM_CLOSED');}});
  return()=>{alive=false;generation.current++;abort.abort();};
 },[code]);
 async function submit(){
  if(submitting.current||loading)return;if(!nickname.trim()){setError('닉네임을 입력해 주세요.');return;}
  submitting.current=true;
  const current=++generation.current;setLoading(true);setError('');
  try{
   const result=await requestRoom(code,nickname,controller.current?.signal);
   if(current!==generation.current)return;
   if(result.ok){if(!code){const url=new URL(location.href);url.searchParams.set('room',result.data.inviteCode);history.replaceState(null,'',url);}setRoom(result.data);}else{setError(result.code==='STATE_CONFLICT'?'이미 사용 중인 닉네임이에요. 다른 이름을 입력해 주세요.':result.message);setMissing(result.code==='NOT_FOUND'||result.code==='ROOM_CLOSED');}
  }finally{submitting.current=false;if(current===generation.current)setLoading(false);}
 }
 useEffect(()=>{
  if(!room||room.closed)return;
  const order=new SnapshotOrder(room.version);let alive=true;let timer:ReturnType<typeof setTimeout>|undefined;let pending:AbortController|undefined;
  async function poll(){
   clearTimeout(timer);if(!alive||document.visibilityState==='hidden')return;
   pending?.abort();pending=new AbortController();const sequence=order.begin();
   const request=pending;const timeout=setTimeout(()=>request.abort(),6000);
   let result;
   try{result=await requestRoom(room!.inviteCode,undefined,request.signal,true);}finally{clearTimeout(timeout);}
   if(!alive||!order.current(sequence))return;
   if(!result.ok&&result.code==='SESSION_REQUIRED')return;
   if(result.ok){if(result.data.version>=latestVersion.current&&order.accept(sequence,result.data.version)){setRoom(previous=>mergeRoomSnapshot(previous,result.data));setError('');setReconnecting(false);setExcluded(false);}}
   else{setReconnecting(true);if(result.code==='FORBIDDEN')setExcluded(true);setError(result.code==='NETWORK_ERROR'?'연결이 끊겼어요. 마지막 화면을 유지하고 다시 연결 중이에요.':result.message);}
   timer=setTimeout(()=>void poll(),3000);
  }
  function visibility(){if(document.visibilityState==='hidden'){clearTimeout(timer);order.begin();pending?.abort();}else void poll();}
  function resume(){void poll();}
  pollNow.current=poll;void poll();document.addEventListener('visibilitychange',visibility);window.addEventListener('focus',resume);window.addEventListener('online',resume);window.addEventListener('pageshow',resume);
  return()=>{alive=false;clearTimeout(timer);pending?.abort();pollNow.current=async()=>{};document.removeEventListener('visibilitychange',visibility);window.removeEventListener('focus',resume);window.removeEventListener('online',resume);window.removeEventListener('pageshow',resume);};
 },[room?.roomId,room?.closed]);
 async function refresh(){await pollNow.current();}
 function didLeave(memberId:string){if(currentMember.current!==memberId)return;generation.current++;setRoom(null);setLeft(true);setError('');setReconnecting(false);setExcluded(false);setLoading(false);}
 const nextControl=room?.nextGame.canPrepare&&!room.closed&&!excluded?<NextGame key={`next:${room.self.memberId}:${room.preparationVersion}`} room={room} onPrepared={snapshot=>{if(currentMember.current===snapshot.self.memberId)setRoom(previous=>mergeRoomSnapshot(previous,snapshot));}}/>:null;
 const previousControl=room?.historyGameId?<PreviousGame key={room.historyGameId} code={room.inviteCode} gameId={room.historyGameId}/>:null;
 const closeControl=room?.self.isHost&&!room.closed&&!excluded?<CloseRoom key={`close:${room.self.memberId}`} room={room} onClosed={snapshot=>{if(currentMember.current===snapshot.self.memberId)setRoom(previous=>mergeRoomSnapshot(previous,snapshot));}}/>:null;
 const leaveControl=room&&!room.closed?<LeaveRoom key={`leave:${room.self.memberId}`} code={room.inviteCode} memberId={room.self.memberId} onLeft={didLeave}/>:null;
 if(left)return <section className="room-content"><h2>방에서 나왔어요</h2><p>이전 참여는 종료됐어요. 다시 참여해도 진행 중 게임의 투표 권한은 복구되지 않아요.</p><Button onPress={()=>setLeft(false)}>다시 참여하기</Button><p><a href="/">홈으로 돌아가기</a></p></section>;
 if(room?.closed)return <>{room.game?.status==='result'?<><Status>방이 닫혔어요. 완료된 결과는 유지돼요.</Status><ResultView room={room} error={error} onRefresh={refresh}/></>:<section className="room-content"><h2>방이 닫혔어요</h2><p>{room.interrupted?'진행 중인 재판은 판결 없이 중단됐어요.':'이 방에서는 더 이상 참여하거나 게임을 진행할 수 없어요.'}</p>{room.interruption?.caseText&&<><h3>중단된 사건</h3><p>{room.interruption.caseText}</p></>}<a href="/">홈으로 돌아가기</a></section>}</>;
 if(room?.game?.status==='result'&&!excluded)return <><ResultView room={room} error={error} onRefresh={refresh}/>{nextControl}{previousControl}{closeControl}{leaveControl}</>;
 if(room){const link=new URL(location.href);link.search='';link.searchParams.set('room',room.inviteCode);return <section className="room-content"><span className="eyebrow">OUR ROOM</span><h2>{room.interrupted?'재판이 중단됐어요':'우리의 대기실'}</h2>{room.interrupted&&<Status>피고의 참여가 종료되어 재판이 중단됐어요. 중단된 게임의 내용은 표시하지 않아요.</Status>}<p className="body-copy">링크를 공유하고 함께할 친구들을 초대해요.</p><Status>{room.self.isHost?'나 · 방장':'나 · 참가자'}</Status><Input label="초대 링크" value={link.href} readOnly/><Button variant="secondary" onPress={async()=>{await navigator.clipboard.writeText(link.href);setCopied(true);}}>{copied?'링크를 복사했어요':'초대 링크 복사'}</Button>{!excluded&&!room.game&&!room.interrupted&&<><RoomRoles key={`RoomRoles:${room.preparationVersion}`} room={room} onUpdated={snapshot=>setRoom(previous=>mergeRoomSnapshot(previous,snapshot))}/><GameSettings key={`GameSettings:${room.preparationVersion}`} room={room} onSaved={snapshot=>setRoom(previous=>mergeRoomSnapshot(previous,snapshot))}/><PenaltyConsent key={`PenaltyConsent:${room.preparationVersion}`} room={room} onUpdated={snapshot=>setRoom(previous=>mergeRoomSnapshot(previous,snapshot))}/><GameStart key={`GameStart:${room.preparationVersion}`} room={room} onUpdated={snapshot=>setRoom(previous=>mergeRoomSnapshot(previous,snapshot))}/></>}{!excluded&&room.game&&<><StartedGame room={room}/><TrialControls key={`${room.game.gameId}:${room.game.defense.roundNumber}:${room.game.status}`} room={room} onUpdated={snapshot=>setRoom(previous=>mergeRoomSnapshot(previous,snapshot))}/></>}{!room.members.some(member=>member.isHost)&&<Status>현재 방장이 없어요. 참가자가 다시 연결되면 서버가 새 방장을 정해요. 그전에는 방장 권한이 필요한 진행을 기다려 주세요.</Status>}<h3>{excluded?'마지막으로 확인한 ':''}참가자 {room.members.length}명</h3><ul className="room-members">{room.members.map(member=><li data-testid="member" key={member.memberId}><strong>{member.nickname}</strong><span>{member.isHost?'방장 · ':''}{member.role==='defendant'?'피고':'참가자'}{member.memberId===room.self.memberId?' · 나':''}<small className="connection-label">{reconnecting&&member.memberId===room.self.memberId?'연결 확인 중':member.connected?'연결됨':'연결 끊김'}</small></span></li>)}</ul><Button variant="secondary" onPress={refresh}>참가자 새로고침</Button>{error&&<p role="alert" className="field-error" data-reconnecting={reconnecting}>{error}</p>}{excluded&&<p><a href={link.href}>다시 참여하기</a><small className="connection-label">이전 참가 상태를 유지하고 있지 않아요. 링크에서 새로 참여해 주세요.</small></p>}{nextControl}{previousControl}{closeControl}{leaveControl}<p className="field-hint">참가자 목록은 화면을 보고 있을 때 자동으로 갱신돼요. 방 참여만으로 이전 게임 기록이 공개되지는 않아요.</p></section>;}
 return <section className="room-content"><h3>{code?'초대받은 방에 참여해요':'새로운 방을 만들어요'}</h3>{!missing&&<form onSubmit={event=>{event.preventDefault();void submit();}}><Input label="닉네임" value={nickname} onChange={event=>setNickname(event.target.value)} required hint="1~20자의 이름을 입력해 주세요. 앞뒤 공백은 정리돼요. 같은 닉네임으로 이전 신원을 복구할 수는 없어요."/><Button type="submit" loading={loading}>{code?'방 참여하기':'방 만들기'}</Button></form>}{error&&<p role="alert" className="field-error">{error}</p>}{missing&&<a href="/">홈으로 돌아가기</a>}</section>;
}
