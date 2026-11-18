import {useEffect,useRef,useState} from 'react';
import {Button} from './design/components';
import {leaveTravelRoom,removeTravelMember,revokeTravelInvite,transferTravelAdministrator,type TravelSnapshot} from './api/travel-room-client';
export function TravelAdministration({room,onChanged,onLeft,onIdentityLost,onInviteRevoked}:{room:TravelSnapshot;onChanged:(room:TravelSnapshot)=>void;onLeft:()=>void;onIdentityLost:()=>void;onInviteRevoked:()=>void}){
 const [mode,setMode]=useState<'idle'|'transfer'|'remove'|'revoke'|'leave'>('idle');const [target,setTarget]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const live=useRef(true);const request=useRef(crypto.randomUUID());const locked=useRef(false);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 useEffect(()=>{setMode('idle');setTarget('');setError('');request.current=crypto.randomUUID();},[room.version,room.self.isAdmin]);
 const others=room.members.filter(m=>m.membershipId!==room.self.membershipId);
 function choose(next:typeof mode){setMode(next);setTarget('');setError('');request.current=crypto.randomUUID();}
 async function apply(){if(locked.current)return;locked.current=true;setBusy(true);setError('');try{
 const result=mode==='transfer'?await transferTravelAdministrator(room,target,request.current):mode==='remove'?await removeTravelMember(room,target,request.current):mode==='revoke'?await revokeTravelInvite(room,request.current):await leaveTravelRoom(room,request.current);
 if(!live.current)return;
 if(!result.ok){if(['ACCOUNT_REQUIRED','SESSION_REQUIRED'].includes(result.code))onIdentityLost();else setError(result.message);return;}
 if('left'in result.data){onLeft();return;}onChanged(result.data);if(mode==='revoke')onInviteRevoked();setMode('idle');
 }finally{locked.current=false;if(live.current)setBusy(false);}}
 if(mode==='idle')return <section className="travel-card"><h2>멤버와 소속</h2>{room.self.isAdmin?<><Button variant="secondary" disabled={!others.length||room.status==='closed'} onPress={()=>choose('transfer')}>방 관리자 넘기기</Button><Button variant="secondary" disabled={!!room.activeRun||!others.length||room.status==='closed'} onPress={()=>choose('remove')}>멤버 내보내기</Button><Button variant="secondary" disabled={room.status==='closed'} onPress={()=>choose('revoke')}>초대 링크 폐기</Button><p className="travel-muted">방 관리자는 다른 멤버에게 관리자를 넘긴 뒤 나갈 수 있어요. 오프라인이 되어도 자동 이양되지 않아요.</p></>:<Button variant="secondary" disabled={!!room.activeRun||room.status==='closed'} onPress={()=>choose('leave')}>여행방 나가기</Button>}{room.activeRun&&<p className="travel-muted">진행 중인 판의 멤버 변경은 아직 지원하지 않아요.</p>}</section>;
 const label=mode==='transfer'?'새 방 관리자를 골라요':mode==='remove'?'내보낼 멤버를 골라요':mode==='revoke'?'초대 링크를 폐기할까요?':'여행방에서 나갈까요?';
 return <section className="travel-card"><h2>{label}</h2>{(mode==='transfer'||mode==='remove')&&<fieldset className="travel-targets"><legend>{mode==='transfer'?'이양 대상':'내보낼 대상'}</legend>{others.map(m=><label className="travel-checkbox" key={m.membershipId}><input type="radio" name="membership-target" value={m.membershipId} checked={target===m.membershipId} onChange={()=>{setTarget(m.membershipId);request.current=crypto.randomUUID();}}/>{m.nickname}</label>)}</fieldset>}<p>{mode==='transfer'?'선택한 멤버가 방 설정과 멤버 관리를 맡게 돼요. 이번 판 진행자와는 다른 역할이에요.':mode==='revoke'?'기존 초대 링크로는 더 이상 가입할 수 없어요. 이미 가입한 멤버는 유지돼요.':'나간 멤버는 이 방의 기록과 사진에 접근할 수 없어요. 재가입 시 과거 권한 복구는 보장하지 않아요.'}</p>{error&&<p role="alert">{error}</p>}<div className="travel-actions"><Button variant="secondary" disabled={busy} onPress={()=>choose('idle')}>취소</Button><Button loading={busy} disabled={(mode==='transfer'||mode==='remove')&&!target} onPress={apply}>확인</Button></div></section>;
}
