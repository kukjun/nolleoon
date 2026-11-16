import {useEffect,useRef,useState} from 'react';
import type {RoomSnapshot} from '@trip-court/contracts';
import {Button,Status} from './design/components';
import {requestRoom} from './api/rooms-client';
export function PenaltyConsent({room,onUpdated}:{room:RoomSnapshot;onUpdated:(snapshot:RoomSnapshot)=>void}){
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const lock=useRef(false);const alive=useRef(false);const pending=useRef<AbortController|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;pending.current?.abort();};},[]);
 async function submit(decision?:'accepted'|'rejected'){
  if(lock.current||decision&&!room.consent.canDecide)return;lock.current=true;setBusy(true);setError('');const request=new AbortController();pending.current=request;const timeout=setTimeout(()=>request.abort(),6000);
  try{const consent=room.consent;const result=await requestRoom(room.inviteCode,undefined,request.signal,false,undefined,decision?{kind:'consent',decision,penaltyRevision:consent.penaltyRevision,roleRevision:consent.roleRevision,expectedDecisionVersion:consent.decisionVersion}:undefined);
   if(!alive.current)return;if(result.ok)onUpdated(result.data);else setError(result.code==='STATE_CONFLICT'?'벌칙이나 피고의 응답이 변경됐어요. 최신 내용을 확인하고 다시 선택해 주세요.':result.message);
  }finally{clearTimeout(timeout);lock.current=false;if(alive.current)setBusy(false);}
 }
 const consent=room.consent;
 return <section className="penalty-consent" aria-label="저장된 벌칙 확인"><h3>피고의 벌칙 확인</h3><p className="field-hint">아래 내용은 서버에 저장된 벌칙이에요. 방장이 작성 중인 미저장 내용에는 동의하지 않아요.</p><div className="saved-penalty" data-testid="saved-penalty">{room.draft.penaltyText||'아직 저장된 벌칙이 없어요.'}</div><Status tone={consent.status==='accepted'?'success':consent.status==='rejected'?'warning':'neutral'}>{consent.status==='accepted'?'피고가 이 벌칙에 동의했어요.':consent.status==='rejected'?'피고가 이 벌칙을 거절했어요.':'피고의 벌칙 확인을 기다리고 있어요.'}</Status>{consent.canDecide?<div className="consent-actions"><Button disabled={busy} onPress={()=>submit('accepted')}>이 벌칙에 동의</Button><Button variant="secondary" disabled={busy} onPress={()=>submit('rejected')}>이 벌칙 거절</Button></div>:<p className="field-hint">저장된 벌칙은 현재 피고만 수락·거절할 수 있어요. 게임이 시작된 뒤에는 응답을 변경할 수 없어요.</p>}{busy&&<p role="status">응답을 확인하고 있어요.</p>}{error&&<><p role="alert" className="field-error">{error}</p><Button variant="secondary" disabled={busy} onPress={()=>submit()}>최신 벌칙과 응답 확인</Button></>}</section>;
}
