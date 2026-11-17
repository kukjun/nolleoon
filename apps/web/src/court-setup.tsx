import {useCallback,useEffect,useRef,useState} from 'react';
import type {RoomSnapshot} from '@trip-court/contracts';
import {Button} from './design/components';
import {GameSettings} from './game-settings';
import {RoomRoles} from './room-roles';
import {PenaltyConsent} from './penalty-consent';
import {GameStart} from './game-start';
export function CourtSetup({room,onUpdated,onEditing}:{room:RoomSnapshot;onUpdated:(room:RoomSnapshot)=>void;onEditing?:(dirty:boolean)=>void}){
 const [step,setStep]=useState(room.self.isHost?1:2);const [editing,setEditing]=useState(false);const heading=useRef<HTMLHeadingElement>(null);
 const trackEditing=useCallback((value:boolean)=>setEditing(value),[]);
 useEffect(()=>{onEditing?.(editing);},[editing,onEditing]);
 const blocked=room.self.isHost&&(editing||room.draft.version===0);
 function go(next:number){if(next>1&&blocked)return;setStep(next);requestAnimationFrame(()=>{heading.current?.focus();heading.current?.scrollIntoView({block:'start',behavior:'instant'});});}
 return <section className="court-setup" aria-label="재판 준비 단계">
  <nav className="party-step-navigation" aria-label="준비 단계">{['게임 설정','역할·동의','시작 대기'].map((label,index)=><button key={label} type="button" aria-current={step===index+1?'step':undefined} disabled={index>0&&blocked} onClick={()=>go(index+1)}>{index+1} {label}</button>)}</nav>
  <h3 className="party-step-title" ref={heading} tabIndex={-1}>{step===1?'이번 사건은 뭔가요?':step===2?'역할과 벌칙을 확인해요':'모두 모였나요?'}</h3>
  <div hidden={step!==1}><GameSettings room={room} onSaved={onUpdated} onEditing={trackEditing}/><Button disabled={blocked} onPress={()=>go(2)}>역할·동의로 다음</Button></div>
  <div hidden={step!==2}><RoomRoles room={room} onUpdated={onUpdated}/><PenaltyConsent room={room} onUpdated={onUpdated}/><Button onPress={()=>go(3)}>시작 대기로 다음</Button></div>
  <div hidden={step!==3}><p className="field-hint">시작하면 사건·벌칙과 참여 역할이 고정돼요. 이전 단계에서 저장된 내용을 다시 확인할 수 있어요.</p><GameStart room={room} onUpdated={onUpdated}/></div>
 </section>;
}
