import {useEffect,useRef,useState} from 'react';
import type {RoomSnapshot} from '@trip-court/contracts';
import {Button,Input,Status} from './design/components';
import {requestRoom} from './api/rooms-client';
export function GameSettings({room,onSaved}:{room:RoomSnapshot;onSaved:(room:RoomSnapshot)=>void}){
 const [draft,setDraft]=useState(room.draft);const [dirty,setDirty]=useState(false);const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [saved,setSaved]=useState(false);const lock=useRef(false);const alive=useRef(false);const pending=useRef<AbortController|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;pending.current?.abort();};},[]);
 useEffect(()=>{if(!dirty&&!saving)setDraft(room.draft);},[room.draft.version,dirty,saving]);
 function edit(values:Partial<typeof draft>){setDraft(previous=>({...previous,...values}));setDirty(true);setSaved(false);setError('');}
 async function save(){
  if(lock.current)return;lock.current=true;setSaving(true);setSaved(false);setError('');pending.current=new AbortController();const request=pending.current;const timeout=setTimeout(()=>request.abort(),6000);
  try{const result=await requestRoom(room.inviteCode,undefined,request.signal,false,{expectedVersion:draft.version,caseText:draft.caseText,penaltyText:draft.penaltyText,durationMinutes:draft.durationMinutes});
   if(!alive.current)return;
   if(result.ok){setDraft(result.data.draft);setDirty(false);setSaved(true);onSaved(result.data);}else setError(result.code==='STATE_CONFLICT'?'다른 화면에서 설정이 변경됐어요. 작성 내용은 유지했어요. 최신 설정을 불러온 뒤 다시 수정해 주세요.':result.message);
  }finally{clearTimeout(timeout);lock.current=false;if(alive.current)setSaving(false);}
 }
 async function reload(){
  if(lock.current)return;lock.current=true;setSaving(true);setError('');pending.current=new AbortController();const request=pending.current;const timeout=setTimeout(()=>request.abort(),6000);
  try{const result=await requestRoom(room.inviteCode,undefined,request.signal);if(!alive.current)return;if(result.ok){setDraft(result.data.draft);setDirty(false);setSaved(false);onSaved(result.data);}else setError(result.message);}finally{clearTimeout(timeout);lock.current=false;if(alive.current)setSaving(false);}
 }
 if(!room.self.isHost)return <section className="game-settings"><h3>이번 게임 설정</h3><p className="field-hint">방장이 설정을 준비하고 있어요. 참가자는 확인만 할 수 있어요.</p><dl><dt>사건</dt><dd>{room.draft.caseText||'아직 작성하지 않았어요.'}</dd><dt>벌칙</dt><dd>{room.draft.penaltyText||'아직 작성하지 않았어요.'}</dd><dt>제한 시간</dt><dd>{room.draft.durationMinutes}분</dd></dl></section>;
 return <section className="game-settings"><h3>이번 게임 설정</h3><p className="field-hint">방장만 수정할 수 있어요. 빈 초안도 저장할 수 있지만 게임 시작은 아직 지원하지 않아요.</p><form onSubmit={event=>{event.preventDefault();void save();}}><label className="settings-field">사건<textarea aria-label="사건" value={draft.caseText} disabled={saving} onChange={event=>edit({caseText:event.target.value})} rows={4}/><small>최대 2,000자</small></label><label className="settings-field">벌칙<textarea aria-label="벌칙" value={draft.penaltyText} disabled={saving} onChange={event=>edit({penaltyText:event.target.value})} rows={3}/><small>최대 500자</small></label><Input label="제한 시간 (분)" type="number" min={1} max={10} step={1} value={draft.durationMinutes} disabled={saving} onChange={event=>edit({durationMinutes:Number(event.target.value)})}/><Status live>{saving?'설정을 처리하고 있어요.':saved?'설정을 저장했어요.':dirty?'저장하지 않은 변경 사항이 있어요.':draft.version===0?'기본 설정이에요. 아직 저장하지 않았어요.':'저장된 설정을 보고 있어요.'}</Status>{dirty&&room.draft.version>draft.version&&<p className="field-hint">다른 화면에서 새 설정이 저장됐어요. 작성 중인 내용은 유지하고 있어요.</p>}{error&&<p role="alert" className="field-error">{error}</p>}<Button type="submit" loading={saving}>설정 저장</Button><Button variant="secondary" disabled={saving} onPress={reload}>{dirty?'작성 내용 버리고 최신 설정 불러오기':'최신 설정 불러오기'}</Button></form></section>;
}
