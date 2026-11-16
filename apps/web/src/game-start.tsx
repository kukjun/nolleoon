import {useEffect,useRef,useState} from 'react';
import type {RoomSnapshot} from '@trip-court/contracts';
import {Button,Status} from './design/components';
import {requestRoom} from './api/rooms-client';
type Intent={kind:'start';requestId:string;expectedDraftVersion:number;expectedRoleRevision:number;expectedDecisionVersion:number};
export function GameStart({room,onUpdated}:{room:RoomSnapshot;onUpdated:(snapshot:RoomSnapshot)=>void}){
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [intent,setIntent]=useState<Intent|null>(null);const lock=useRef(false);const alive=useRef(false);const pending=useRef<AbortController|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;pending.current?.abort();};},[]);
 const changed=Boolean(intent&&(intent.expectedDraftVersion!==room.draft.version||intent.expectedRoleRevision!==room.roleRevision||intent.expectedDecisionVersion!==room.consent.decisionVersion));
 async function start(){
  if(lock.current||changed||!room.start.canStart&&!intent)return;lock.current=true;setBusy(true);setError('');
  const command=intent??{kind:'start',requestId:crypto.randomUUID(),expectedDraftVersion:room.draft.version,expectedRoleRevision:room.roleRevision,expectedDecisionVersion:room.consent.decisionVersion} as Intent;setIntent(command);
  const request=new AbortController();pending.current=request;const timeout=setTimeout(()=>request.abort(),6000);
  try{const result=await requestRoom(room.inviteCode,undefined,request.signal,false,undefined,command);if(!alive.current)return;if(result.ok)onUpdated(result.data);else setError(result.code==='STATE_CONFLICT'?'시작 조건이나 설정이 바뀌었어요. 최신 상태를 확인해 주세요.':result.message);}finally{clearTimeout(timeout);lock.current=false;if(alive.current)setBusy(false);}
 }
 return <section className="game-start"><h3>재판 시작 준비</h3>{room.start.missing.length>0?<ul>{room.start.missing.map((message,index)=><li key={index}>{message}</li>)}</ul>:<p className="field-hint">시작 조건을 충족했어요.</p>}{room.self.isHost?<><Button disabled={busy||changed||!room.start.canStart&&!intent} onPress={start}>{busy?'시작을 확인하고 있어요.':intent?'같은 시작 요청 다시 확인':'재판 시작'}</Button>{intent&&<p className="field-hint">응답을 받지 못한 요청은 같은 번호와 설정으로만 다시 확인해요. 자동으로 다시 시작하지 않아요.</p>}{changed&&<><p className="field-hint">설정이 변경됐어요. 이전 요청을 다시 보내지 않고 새 설정을 확인해 주세요.</p><Button variant="secondary" disabled={busy} onPress={()=>{setIntent(null);setError('');}}>이전 요청 닫고 새 설정 확인</Button></>}{error&&<p role="alert" className="field-error">{error}</p>}</>:<p className="field-hint">방장이 시작하면 함께 재판으로 이동해요.</p>}</section>;
}
export function StartedGame({room}:{room:RoomSnapshot}){
 const game=room.game;if(!game)return null;
 return <section className="started-game"><h3>재판이 시작됐어요</h3><Status>현재 단계 · {game.status==='defense'?'변론':game.status==='voting'?'투표':game.status==='final-defense'?'최후 변론':game.status==='result'?'결과':'중단'}</Status><p data-testid="game-role">내 게임 역할 · {game.self.role==='defendant'?'피고':game.self.role==='observer'?'관전자':'참가자'}</p><p>{game.self.eligible?'이번 게임의 투표 대상이에요.':'이번 게임에서는 투표하지 않아요.'}</p><dl><dt>사건</dt><dd>{game.caseText}</dd><dt>벌칙</dt><dd>{game.penaltyText}</dd><dt>설정된 제한 시간</dt><dd>{game.durationMinutes}분</dd></dl><p className="field-hint">현재 게임 참여 {game.participantCount}명 · 투표 대상 {game.voterCount}명</p><p className="field-hint">시작 시 사건·벌칙과 투표 대상을 고정했어요. 변론과 투표 시작은 아래에서 진행해요. 투표 대상자는 아래에서 한 번만 제출할 수 있어요.</p></section>;
}
