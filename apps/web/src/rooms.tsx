import {useEffect,useRef,useState} from 'react';
import type {RoomSnapshot} from '@trip-court/contracts';
import {Button,Input,Status} from './design/components';
import {TrialControls} from './trial-controls';
import {GameStart,StartedGame} from './game-start';
import {PenaltyConsent} from './penalty-consent';
import {RoomRoles} from './room-roles';
import {GameSettings} from './game-settings';
import {SnapshotOrder} from './api/snapshot-order';
import {requestRoom} from './api/rooms-client';
export function Rooms({onJoined}:{onJoined?:(joined:boolean)=>void}){
 const code=new URL(location.href).searchParams.get('room');
 const [room,setRoom]=useState<RoomSnapshot|null>(null);const [nickname,setNickname]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(Boolean(code));const [copied,setCopied]=useState(false);const [missing,setMissing]=useState(false);
 const [reconnecting,setReconnecting]=useState(false);const [excluded,setExcluded]=useState(false);
 const latestVersion=useRef(0);if(room)latestVersion.current=Math.max(latestVersion.current,room.version);
 const pollNow=useRef<()=>Promise<void>>(async()=>{});
 const submitting=useRef(false);
 useEffect(()=>{onJoined?.(Boolean(room));},[Boolean(room),onJoined]);
 const generation=useRef(0);const controller=useRef<AbortController|null>(null);
 useEffect(()=>{let alive=true;const abort=new AbortController();controller.current=abort;const current=++generation.current;
  if(code&&!room)void requestRoom(code,undefined,abort.signal).then(result=>{if(!alive||current!==generation.current)return;setLoading(false);if(result.ok)setRoom(result.data);else if(result.code!=='FORBIDDEN'){setError(result.message);setMissing(result.code==='NOT_FOUND');}});
  return()=>{alive=false;generation.current++;abort.abort();};
 },[code]);
 async function submit(){
  if(submitting.current||loading)return;if(!nickname.trim()){setError('닉네임을 입력해 주세요.');return;}
  submitting.current=true;
  const current=++generation.current;setLoading(true);setError('');
  try{
   const result=await requestRoom(code,nickname,controller.current?.signal);
   if(current!==generation.current)return;
   if(result.ok){if(!code){const url=new URL(location.href);url.searchParams.set('room',result.data.inviteCode);history.replaceState(null,'',url);}setRoom(result.data);}else{setError(result.code==='STATE_CONFLICT'?'이미 사용 중인 닉네임이에요. 다른 이름을 입력해 주세요.':result.message);setMissing(result.code==='NOT_FOUND');}
  }finally{submitting.current=false;if(current===generation.current)setLoading(false);}
 }
 useEffect(()=>{
  if(!room)return;
  const order=new SnapshotOrder(room.version);let alive=true;let timer:ReturnType<typeof setTimeout>|undefined;let pending:AbortController|undefined;
  async function poll(){
   clearTimeout(timer);if(!alive||document.visibilityState==='hidden')return;
   pending?.abort();pending=new AbortController();const sequence=order.begin();
   const request=pending;const timeout=setTimeout(()=>request.abort(),6000);
   let result;
   try{result=await requestRoom(room!.inviteCode,undefined,request.signal,true);}finally{clearTimeout(timeout);}
   if(!alive||!order.current(sequence))return;
   if(result.ok){if(result.data.version>=latestVersion.current&&order.accept(sequence,result.data.version)){setRoom(previous=>previous&&previous.version>result.data.version?previous:result.data);setError('');setReconnecting(false);setExcluded(false);}}
   else{setReconnecting(true);if(result.code==='FORBIDDEN')setExcluded(true);setError(result.code==='NETWORK_ERROR'?'연결이 끊겼어요. 마지막 화면을 유지하고 다시 연결 중이에요.':result.message);}
   timer=setTimeout(()=>void poll(),3000);
  }
  function visibility(){if(document.visibilityState==='hidden'){clearTimeout(timer);order.begin();pending?.abort();}else void poll();}
  function resume(){void poll();}
  pollNow.current=poll;void poll();document.addEventListener('visibilitychange',visibility);window.addEventListener('focus',resume);window.addEventListener('online',resume);
  return()=>{alive=false;clearTimeout(timer);pending?.abort();pollNow.current=async()=>{};document.removeEventListener('visibilitychange',visibility);window.removeEventListener('focus',resume);window.removeEventListener('online',resume);};
 },[room?.roomId]);
 async function refresh(){await pollNow.current();}
 if(room){const link=new URL(location.href);link.search='';link.searchParams.set('room',room.inviteCode);return <section className="room-content"><span className="eyebrow">OUR ROOM</span><h2>우리의 대기실</h2><p className="body-copy">링크를 공유하고 함께할 친구들을 초대해요.</p><Status>{room.self.isHost?'나 · 방장':'나 · 참가자'}</Status><Input label="초대 링크" value={link.href} readOnly/><Button variant="secondary" onPress={async()=>{await navigator.clipboard.writeText(link.href);setCopied(true);}}>{copied?'링크를 복사했어요':'초대 링크 복사'}</Button>{!excluded&&!room.game&&<><RoomRoles room={room} onUpdated={snapshot=>setRoom(previous=>previous&&previous.version>snapshot.version?previous:snapshot)}/><GameSettings room={room} onSaved={snapshot=>setRoom(previous=>previous&&previous.version>snapshot.version?previous:snapshot)}/><PenaltyConsent room={room} onUpdated={snapshot=>setRoom(previous=>previous&&previous.version>snapshot.version?previous:snapshot)}/><GameStart room={room} onUpdated={snapshot=>setRoom(previous=>previous&&previous.version>snapshot.version?previous:snapshot)}/></>}{!excluded&&room.game&&<><StartedGame room={room}/><TrialControls room={room} onUpdated={snapshot=>setRoom(previous=>previous&&previous.version>snapshot.version?previous:snapshot)}/></>}<h3>{excluded?'마지막으로 확인한 ':''}참가자 {room.members.length}명</h3><ul className="room-members">{room.members.map(member=><li data-testid="member" key={member.memberId}><strong>{member.nickname}</strong><span>{member.isHost?'방장 · ':''}{member.role==='defendant'?'피고':'참가자'}{member.memberId===room.self.memberId?' · 나':''}<small className="connection-label">{reconnecting&&member.memberId===room.self.memberId?'연결 확인 중':member.connected?'연결됨':'연결 끊김'}</small></span></li>)}</ul><Button variant="secondary" onPress={refresh}>참가자 새로고침</Button>{error&&<p role="alert" className="field-error" data-reconnecting={reconnecting}>{error}</p>}{excluded&&<p><a href={link.href}>다시 참여하기</a><small className="connection-label">이전 참가 상태를 유지하고 있지 않아요. 링크에서 새로 참여해 주세요.</small></p>}<p className="field-hint">참가자 목록은 화면을 보고 있을 때 자동으로 갱신돼요. 게임 시작은 다음 단계에서 추가됩니다. 방 참여만으로 이전 게임 기록이 공개되지는 않아요.</p></section>;}
 return <section className="room-content"><h3>{code?'초대받은 방에 참여해요':'새로운 방을 만들어요'}</h3>{!missing&&<form onSubmit={event=>{event.preventDefault();void submit();}}><Input label="닉네임" value={nickname} onChange={event=>setNickname(event.target.value)} required hint="1~20자의 이름을 입력해 주세요. 앞뒤 공백은 정리돼요. 같은 닉네임으로 이전 신원을 복구할 수는 없어요."/><Button type="submit" loading={loading}>{code?'방 참여하기':'방 만들기'}</Button></form>}{error&&<p role="alert" className="field-error">{error}</p>}{missing&&<a href="/">홈으로 돌아가기</a>}</section>;
}
