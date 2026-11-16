import {useEffect,useRef,useState} from 'react';
import type {RoomSnapshot} from '@trip-court/contracts';
import {Button,Input,Status} from './design/components';
import {requestRoom} from './api/rooms-client';
export function Rooms(){
 const code=new URL(location.href).searchParams.get('room');
 const [room,setRoom]=useState<RoomSnapshot|null>(null);const [nickname,setNickname]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(Boolean(code));const [copied,setCopied]=useState(false);const [missing,setMissing]=useState(false);
 const submitting=useRef(false);
 const generation=useRef(0);const controller=useRef<AbortController|null>(null);
 useEffect(()=>{let alive=true;const abort=new AbortController();controller.current=abort;const current=++generation.current;
  if(code)void requestRoom(code,undefined,abort.signal).then(result=>{if(!alive||current!==generation.current)return;setLoading(false);if(result.ok)setRoom(result.data);else if(result.code!=='FORBIDDEN'){setError(result.message);setMissing(result.code==='NOT_FOUND');}});
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
 async function refresh(){if(!room)return;const current=++generation.current;setError('');const result=await requestRoom(room.inviteCode,undefined,controller.current?.signal);if(current!==generation.current)return;if(result.ok)setRoom(result.data);else setError(result.message);}
 if(room){const link=new URL(location.href);link.search='';link.searchParams.set('room',room.inviteCode);return <section className="room-content"><span className="eyebrow">OUR ROOM</span><h2>우리의 대기실</h2><p className="body-copy">링크를 공유하고 함께할 친구들을 초대해요.</p><Status>{room.self.isHost?'나 · 방장':'나 · 참가자'}</Status><Input label="초대 링크" value={link.href} readOnly/><Button variant="secondary" onPress={async()=>{await navigator.clipboard.writeText(link.href);setCopied(true);}}>{copied?'링크를 복사했어요':'초대 링크 복사'}</Button><h3>참가자 {room.members.length}명</h3><ul className="room-members">{room.members.map(member=><li data-testid="member" key={member.memberId}><strong>{member.nickname}</strong><span>{member.isHost?'방장':'참가자'}{member.memberId===room.self.memberId?' · 나':''}</span></li>)}</ul><Button variant="secondary" onPress={refresh}>참가자 새로고침</Button>{error&&<p role="alert" className="field-error">{error}</p>}<p className="field-hint">참가자 목록은 새로고침으로 확인해요. 게임 설정과 역할 선택은 다음 단계에서 추가됩니다. 방 참여만으로 이전 게임 기록이 공개되지는 않아요.</p></section>;}
 return <section className="room-content"><h3>{code?'초대받은 방에 참여해요':'새로운 방을 만들어요'}</h3>{!missing&&<form onSubmit={event=>{event.preventDefault();void submit();}}><Input label="닉네임" value={nickname} onChange={event=>setNickname(event.target.value)} required hint="1~20자의 이름을 입력해 주세요. 앞뒤 공백은 정리돼요. 같은 닉네임으로 이전 신원을 복구할 수는 없어요."/><Button type="submit" loading={loading}>{code?'방 참여하기':'방 만들기'}</Button></form>}{error&&<p role="alert" className="field-error">{error}</p>}{missing&&<a href="/">홈으로 돌아가기</a>}</section>;
}
