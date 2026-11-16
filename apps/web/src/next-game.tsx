import {useEffect,useRef,useState} from 'react';
import type {RoomSnapshot} from '@trip-court/contracts';
import {Button,Modal} from './design/components';
import {requestRoom,type RoomCommand} from './api/rooms-client';
export function NextGame({room,onPrepared}:{room:RoomSnapshot;onPrepared:(snapshot:RoomSnapshot)=>void}){
 const [open,setOpen]=useState(false);const [pending,setPending]=useState(false);const [error,setError]=useState('');
 const lock=useRef(false);const request=useRef<AbortController|null>(null);const intent=useRef<Extract<RoomCommand,{kind:'next-game'}>|null>(null);
 const alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;request.current?.abort();};},[]);
 async function prepare(){
  if(lock.current||!room.nextGame.fromGameId)return;lock.current=true;setPending(true);setError('');
  intent.current??={kind:'next-game',requestId:crypto.randomUUID(),fromGameId:room.nextGame.fromGameId,expectedPreparationVersion:room.preparationVersion};
  const abort=new AbortController();request.current=abort;const timer=setTimeout(()=>abort.abort(),6000);
  try{const result=await requestRoom(room.inviteCode,undefined,abort.signal,false,undefined,intent.current);if(!alive.current)return;if(result.ok)onPrepared(result.data);else if(!abort.signal.aborted||request.current===abort)setError(result.message);}
  finally{clearTimeout(timer);lock.current=false;if(alive.current&&request.current===abort)setPending(false);}
 }
 return <><Button onPress={()=>setOpen(true)}>다음 게임 준비</Button><Modal open={open} title="다음 게임을 준비할까요?" onDismiss={()=>{if(!lock.current)setOpen(false);}}><p>방과 참가자는 그대로 유지해요. 사건·벌칙·동의·역할은 새로 정하고 제한 시간은 3분으로 시작해요. 지난 결과는 이전 게임 기록에서 확인할 수 있어요.</p>{error&&<p role="alert" className="field-error">{error}</p>}<Button loading={pending} onPress={prepare}>{error?'다음 게임 준비 다시 확인':'다음 게임 준비 확인'}</Button><Button variant="secondary" disabled={pending} onPress={()=>setOpen(false)}>취소</Button></Modal></>;
}
