import {useEffect,useRef,useState} from 'react';
import type {RoomSnapshot} from '@trip-court/contracts';
import {Button,Modal} from './design/components';
import {requestRoom} from './api/rooms-client';
export function CloseRoom({room,onClosed}:{room:RoomSnapshot;onClosed:(snapshot:RoomSnapshot)=>void}){
 const [open,setOpen]=useState(false);const [pending,setPending]=useState(false);const [error,setError]=useState('');
 const lock=useRef(false);const request=useRef<AbortController|null>(null);
 useEffect(()=>()=>request.current?.abort(),[]);
 async function close(){
  if(lock.current)return;lock.current=true;setPending(true);setError('');const abort=new AbortController();request.current=abort;
  try{const result=await requestRoom(room.inviteCode,undefined,abort.signal,false,undefined,{kind:'close',expectedMemberId:room.self.memberId});if(abort.signal.aborted)return;if(result.ok&&result.data.closed)onClosed(result.data);else setError(result.ok?'방 종료 결과를 확인하지 못했어요. 같은 요청을 다시 확인해 주세요.':result.message);}
  finally{lock.current=false;if(!abort.signal.aborted)setPending(false);}
 }
 return <><Button variant="secondary" onPress={()=>setOpen(true)}>방 닫기</Button><Modal open={open} title="방을 닫을까요?" onDismiss={()=>{if(!lock.current)setOpen(false);}}><p>닫힌 방에는 다시 참여할 수 없어요. 진행 중인 재판은 판결 없이 중단되며 조기 판결을 내리지 않아요. 이미 완료된 결과는 유지돼요.</p>{error&&<p role="alert" className="field-error">{error}</p>}<Button loading={pending} onPress={close}>{error?'방 종료 결과 다시 확인':'방 닫기 확인'}</Button><Button variant="secondary" disabled={pending} onPress={()=>setOpen(false)}>계속 진행하기</Button></Modal></>;
}
