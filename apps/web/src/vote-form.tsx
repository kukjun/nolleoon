import {useEffect,useRef,useState} from 'react';
import type {RoomSnapshot} from '@trip-court/contracts';
import {Button,ChoiceGroup,Status} from './design/components';
import {requestRoom,type RoomCommand} from './api/rooms-client';
type VoteCommand=Extract<RoomCommand,{kind:'vote'}>;
const choiceLabels={guilty:'유죄','not-guilty':'무죄',abstain:'기권'};
export function VoteForm({room,seconds,onUpdated}:{room:RoomSnapshot;seconds:number;onUpdated:(room:RoomSnapshot)=>void}){
 const game=room.game!;const [choice,setChoice]=useState('');const [reason,setReason]=useState('');const [deadlineRejected,setDeadlineRejected]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [intent,setIntent]=useState<VoteCommand|null>(null);const lock=useRef(false);const alive=useRef(false);const pending=useRef<AbortController|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;pending.current?.abort();};},[]);
 const receipt=game.ownVote?.roundNumber===game.round?.number?game.ownVote:null;
 async function submit(){
  if(lock.current||deadlineRejected||receipt||!game.round||game.status!=='voting'||!game.self.eligible||seconds===0&&!intent)return;
  if(!intent&&(!choice||choice!=='abstain'&&!reason.trim())){setError('판단을 선택하고 유죄·무죄에는 이유를 입력해 주세요.');return;}
  if(!intent&&Array.from(reason.trim()).length>2000){setError('이유는 2,000자 이내로 입력해 주세요.');return;}
  lock.current=true;setBusy(true);setError('');const command=intent??{kind:'vote',gameId:game.gameId,roundNumber:game.round.number,requestId:crypto.randomUUID(),choice:choice as VoteCommand['choice'],reason} as const;setIntent(command);
  const request=new AbortController();pending.current=request;const timeout=setTimeout(()=>request.abort(),6000);
  try{const result=await requestRoom(room.inviteCode,undefined,request.signal,false,undefined,command);if(!alive.current)return;if(result.ok)onUpdated(result.data);else{setError(result.message);if(result.code==='INVALID_INPUT')setIntent(null);if(result.code==='DEADLINE_PASSED'){setIntent(null);setDeadlineRejected(true);}}}finally{clearTimeout(timeout);lock.current=false;if(alive.current)setBusy(false);}
 }
 if(!game.self.eligible||game.self.role!=='participant')return <p className="field-hint">이번 라운드는 투표 대상자가 아니에요.</p>;
 if(receipt)return <section className="vote-receipt" aria-label="내 투표 접수"><Status tone="success">내 투표가 접수됐어요.</Status><p>내 판단 · {choiceLabels[receipt.choice]}</p><p className="vote-reason">{receipt.reason||'작성한 이유가 없어요.'}</p><p className="field-hint">제출한 투표는 변경할 수 없어요. 다른 사람의 투표나 이유는 아직 공개되지 않아요. 결과 처리를 기다려 주세요.</p></section>;
 if(deadlineRejected)return <p role="status">서버에서 투표 마감을 확인했어요. 새 투표는 제출할 수 없어요.</p>;
 if(seconds===0&&!intent)return <p>제출 시간이 끝났어요. 서버의 확인을 기다려 주세요.</p>;
 return <section className="vote-form"><h4>내 판단을 남겨요</h4><form onSubmit={event=>{event.preventDefault();void submit();}}><fieldset disabled={busy||Boolean(intent)} className="role-fieldset"><ChoiceGroup label="익명 투표" value={choice} onChange={setChoice} options={[{value:'guilty',label:'유죄'},{value:'not-guilty',label:'무죄'},{value:'abstain',label:'기권'}]}/><label className="settings-field">투표 이유<textarea aria-label="투표 이유" value={reason} onChange={event=>setReason(event.target.value)} rows={3}/><small>유죄·무죄는 필수, 기권은 선택이에요. 최대 2,000자.</small></label></fieldset><p className="field-hint">접수 후에는 바꿀 수 없어요. 이유에 본인 정보가 있으면 익명성이 약해질 수 있어요.</p>{error&&<p role="alert" className="field-error">{error}</p>}{busy&&<p role="status">서버의 투표 접수를 확인하고 있어요.</p>}<Button type="submit" disabled={busy}>{intent?'같은 투표 요청 다시 확인':'투표 제출'}</Button>{intent&&<p className="field-hint">응답이 불확실하면 같은 선택·이유·요청 번호로 다시 확인해요. 성공으로 간주하지 않아요.</p>}</form></section>;
}
