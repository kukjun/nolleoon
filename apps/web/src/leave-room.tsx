import {useEffect,useRef,useState} from 'react';
import {Button,Modal} from './design/components';
import {requestLeave} from './api/rooms-client';
export function LeaveRoom({code,memberId,onLeft}:{code:string;memberId:string;onLeft:(memberId:string)=>void}){
 const [open,setOpen]=useState(false);const [pending,setPending]=useState(false);const [error,setError]=useState('');
 const lock=useRef(false);const request=useRef<AbortController|null>(null);
 useEffect(()=>()=>{request.current?.abort();},[]);
 async function leave(){
  if(lock.current)return;lock.current=true;setPending(true);setError('');
  const abort=new AbortController();request.current=abort;
  try{const result=await requestLeave(code,memberId,abort.signal);if(abort.signal.aborted)return;if(result.ok)onLeft(result.memberId);else setError(result.message);}
  finally{lock.current=false;if(!abort.signal.aborted)setPending(false);}
 }
 return <><Button variant="secondary" onPress={()=>setOpen(true)}>방 나가기</Button><Modal open={open} title="방에서 나갈까요?" onDismiss={()=>{if(!lock.current)setOpen(false);}}><p>현재 참여가 종료돼요. 진행 중인 게임에 다시 들어오면 관전자로 참여하며 이전 투표 권한은 돌아오지 않아요.</p>{error&&<p role="alert" className="field-error">{error}</p>}<Button loading={pending} onPress={leave}>{error?'나가기 결과 다시 확인':'나가기 확인'}</Button><Button variant="secondary" disabled={pending} onPress={()=>setOpen(false)}>계속 참여하기</Button></Modal></>;
}
