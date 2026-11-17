import {AvatarPicker} from './avatar-picker';
import {AvatarProvider,MemberAvatar} from './avatar';
import {useEffect,useRef,useState} from 'react';
import type {RoomSnapshot} from '@trip-court/contracts';
import {Button,Input,Status} from './design/components';
import {identityLoss} from './api/identity-generation';
import {PartyLobby} from './party-lobby';
import {NextGame} from './next-game';
import {PreviousGame} from './previous-game';
import {CloseRoom} from './close-room';
import {LeaveRoom} from './leave-room';
import {ResultView} from './result-view';
import {mergeRoomSnapshot} from './api/room-merge';
import {TrialControls} from './trial-controls';
import {StartedGame} from './game-start';
import {CourtSetup} from './court-setup';
import {SnapshotOrder} from './api/snapshot-order';
import {requestRoom} from './api/rooms-client';
export function Rooms({onJoined,onIdentityLost}:{onJoined?:(joined:boolean)=>void;onIdentityLost:()=>void}){
 useEffect(()=>identityLoss.subscribe(onIdentityLost),[onIdentityLost]);
 const code=new URL(location.href).searchParams.get('room');
 const [avatarBusy,setAvatarBusy]=useState(false);const [room,setRoom]=useState<RoomSnapshot|null>(null);const [nickname,setNickname]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(Boolean(code));const [copied,setCopied]=useState(false);const [missing,setMissing]=useState(false);
 const [nicknameError,setNicknameError]=useState('');const joinForm=useRef<HTMLFormElement|null>(null);
 const [preparing,setPreparing]=useState(false);
 const [left,setLeft]=useState(false);const currentMember=useRef<string|null>(null);currentMember.current=room?.self.memberId??null;
 const [reconnecting,setReconnecting]=useState(false);const [excluded,setExcluded]=useState(false);
 const latestVersion=useRef(0);if(room)latestVersion.current=Math.max(latestVersion.current,room.version);
 const pollNow=useRef<()=>Promise<void>>(async()=>{});
 const submitting=useRef(false);
 useEffect(()=>{onJoined?.(Boolean(room)||left);},[Boolean(room),left,onJoined]);
 const generation=useRef(0);const controller=useRef<AbortController|null>(null);
 const [lookupFailed,setLookupFailed]=useState(false);
 async function entryRequest(name?:string){
  controller.current?.abort();
  const abort=new AbortController();controller.current=abort;
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([
   requestRoom(code,name,abort.signal),
   new Promise<undefined>(resolve=>{timer=setTimeout(()=>{resolve(undefined);abort.abort();},6000);})
  ]);}finally{clearTimeout(timer);if(controller.current===abort)controller.current=null;}
 }
 async function lookup(){
  const current=++generation.current;setLoading(true);setError('');setLookupFailed(false);
  const result=await entryRequest();
  if(current!==generation.current)return;
  setLoading(false);
  if(!result){setLookupFailed(true);setError('방 연결 확인이 늦어지고 있어요. 다시 확인해 주세요.');return;}
  if(result.ok)setRoom(result.data);
  else if(result.code!=='FORBIDDEN'){
   setError(result.message);setMissing(result.code==='NOT_FOUND'||result.code==='ROOM_CLOSED');
   setLookupFailed(result.code==='NETWORK_ERROR');
  }
 }
 useEffect(()=>{
  if(code&&!room)void lookup();
  return()=>{generation.current++;controller.current?.abort();};
 },[code]);
 async function submit(){
  if(submitting.current||loading||avatarBusy)return;if(!nickname.trim()){setNicknameError('닉네임을 입력해 주세요.');joinForm.current?.querySelector('input')?.focus();return;}
  submitting.current=true;
  const current=++generation.current;setLoading(true);setError('');setNicknameError('');
  try{
   const result=await entryRequest(nickname);
   if(current!==generation.current)return;
   if(!result||(!result.ok&&result.code==='NETWORK_ERROR')){setError('응답을 확인하지 못했어요. 서버에서 이미 처리됐을 수도 있어요. 닉네임은 유지했어요. 참여는 같은 링크에서 다시 시도할 수 있고, 방 만들기를 다시 누르면 새 방이 생길 수 있어요.');return;}
   if(result.ok){if(!code){const url=new URL(location.href);url.searchParams.set('room',result.data.inviteCode);history.replaceState(null,'',url);}setRoom(result.data);}else{if(result.code==='STATE_CONFLICT'||result.code==='INVALID_INPUT'){setNicknameError(result.code==='STATE_CONFLICT'?'이미 사용 중인 닉네임이에요. 다른 이름을 입력해 주세요.':result.message);joinForm.current?.querySelector('input')?.focus();}else setError(result.message);setMissing(result.code==='NOT_FOUND'||result.code==='ROOM_CLOSED');}
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
 if(room?.closed)return <AvatarProvider code={room.inviteCode}>{room.game?.status==='result'?<><Status>방이 닫혔어요. 완료된 결과는 유지돼요.</Status><ResultView room={room} error={error} onRefresh={refresh}/></>:<section className="room-content"><h2>방이 닫혔어요</h2><p>{room.interrupted?'진행 중인 재판은 판결 없이 중단됐어요.':'이 방에서는 더 이상 참여하거나 게임을 진행할 수 없어요.'}</p>{room.interruption?.caseText&&<><h3>중단된 사건</h3><p>{room.interruption.caseText}</p></>}<a href="/">홈으로 돌아가기</a></section>}</AvatarProvider>;
 if(room?.game?.status==='result'&&!excluded)return <AvatarProvider code={room.inviteCode}><ResultView room={room} error={error} onRefresh={refresh}/>{nextControl}{previousControl}{closeControl}{leaveControl}</AvatarProvider>;
 if(room){const link=new URL(location.href);link.search='';link.searchParams.set('room',room.inviteCode);return <AvatarProvider code={room.inviteCode}><section className={`room-content compact-room ${room.game?'in-trial':'in-setup'}`}>{(room.game||preparing||room.interrupted)&&<><span className="eyebrow">{room.game?'OUR TRIAL':'OUR ROOM'}</span><h2>{room.interrupted?'재판이 중단됐어요':room.game?.status==='voting'?'투표 중':room.game?.status==='final-defense'?'최후 변론':room.game?'변론 중':'우리의 대기실'}</h2></>}{room.interrupted&&<Status>피고의 참여가 종료되어 재판이 중단됐어요. 중단된 게임의 내용은 표시하지 않아요.</Status>}{(room.game||preparing)&&(!room.game||room.self.isHost)&&<Status>{room.self.isHost?'나 · 방장':'나 · 참가자'}</Status>}{!excluded&&!room.game&&!room.interrupted&&!preparing&&<PartyLobby room={room} reconnecting={reconnecting} onPrepare={()=>setPreparing(true)} renderAvatar={member=><MemberAvatar memberId={member.memberId} nickname={member.nickname} size="large"/>}/>}
{!excluded&&!room.game&&!room.interrupted&&<div hidden={!preparing}><Button variant="quiet" onPress={()=>setPreparing(false)}>대기실로 돌아가기</Button><CourtSetup key={`court:${room.preparationVersion}`} room={room} onUpdated={snapshot=>setRoom(previous=>mergeRoomSnapshot(previous,snapshot))}/></div>}{!excluded&&room.game&&<><div className="avatar-game-self"><MemberAvatar memberId={room.self.memberId} nickname={room.members.find(m=>m.memberId===room.self.memberId)?.nickname??'나'}/><span>나 · {room.game.self.role==='defendant'?'피고':room.game.self.role==='observer'?'관전자':'참가자'}</span></div><StartedGame room={room}/><TrialControls key={`${room.game.gameId}:${room.game.defense.roundNumber}:${room.game.status}`} room={room} onUpdated={snapshot=>setRoom(previous=>mergeRoomSnapshot(previous,snapshot))}/></>}{!room.members.some(member=>member.isHost)&&<Status>현재 방장이 없어요. 참가자가 다시 연결되면 서버가 새 방장을 정해요. 그전에는 방장 권한이 필요한 진행을 기다려 주세요.</Status>}<details className="room-extras"><summary>초대 링크 · 참가자 {room.members.length}명</summary><div className="room-extra-content"><Input label="초대 링크" value={link.href} readOnly/><Button variant="secondary" onPress={async()=>{await navigator.clipboard.writeText(link.href);setCopied(true);}}>{copied?'링크를 복사했어요':'초대 링크 복사'}</Button><h3>{excluded?'마지막으로 확인한 ':''}참가자 {room.members.length}명</h3><ul className="room-members">{room.members.map(member=><li data-testid="member" key={member.memberId}><MemberAvatar memberId={member.memberId} nickname={member.nickname} size="small"/><strong>{member.nickname}</strong><span>{member.isHost?'방장 · ':''}{member.role==='defendant'?'피고':'참가자'}{member.memberId===room.self.memberId?' · 나':''}<small className="connection-label">{reconnecting&&member.memberId===room.self.memberId?'연결 확인 중':member.connected?'연결됨':'연결 끊김'}</small></span></li>)}</ul><Button variant="secondary" onPress={refresh}>참가자 새로고침</Button></div></details>{error&&<p role="alert" className="field-error" data-reconnecting={reconnecting}>{error}</p>}{excluded&&<p><a href={link.href}>다시 참여하기</a><small className="connection-label">이전 참가 상태를 유지하고 있지 않아요. 링크에서 새로 참여해 주세요.</small></p>}{nextControl}{previousControl}{closeControl}{leaveControl}<p className="field-hint">참가자 목록은 화면을 보고 있을 때 자동으로 갱신돼요. 방 참여만으로 이전 게임 기록이 공개되지는 않아요.</p></section></AvatarProvider>;}
 return <section className="room-content"><h3>{code?'초대받은 방에 참여해요':'새로운 방을 만들어요'}</h3>{!missing&&<AvatarPicker onBusyChange={setAvatarBusy}/>}
{!missing&&<form ref={joinForm} onSubmit={event=>{event.preventDefault();void submit();}}><Input label="닉네임" error={nicknameError} value={nickname} onChange={event=>{setNickname(event.target.value);setNicknameError('');}} required hint="1~20자의 이름을 입력해 주세요. 앞뒤 공백은 정리돼요. 같은 닉네임으로 이전 신원을 복구할 수는 없어요."/><Button type="submit" loading={loading} disabled={lookupFailed||avatarBusy}>{code?'방 참여하기':'방 만들기'}</Button></form>}{error&&<p role="alert" className="field-error">{error}</p>}{lookupFailed&&<Button onPress={lookup}>방 연결 다시 확인</Button>}{missing&&<a href="/">홈으로 돌아가기</a>}</section>;
}
