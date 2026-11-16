import {useEffect,useRef,useState} from 'react';
import type {GameHistoryDetail} from '@trip-court/contracts';
import {Button} from './design/components';
import {requestGameHistory} from './api/rooms-client';
import {SettlementPanel} from './settlement-panel';
import {PublishedRounds} from './published-rounds';
export function PreviousGame({code,gameId}:{code:string;gameId:string}){
 const [record,setRecord]=useState<GameHistoryDetail|null>(null);const [error,setError]=useState('');const [pending,setPending]=useState(false);const request=useRef<AbortController|null>(null);
 const alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;request.current?.abort();};},[]);
 async function load(){if(request.current)return;const abort=new AbortController();request.current=abort;setPending(true);setError('');const timer=setTimeout(()=>abort.abort(),6000);try{const result=await requestGameHistory(code,gameId,abort.signal);if(!alive.current)return;if(result.ok)setRecord(result.data);else setError(result.message);}finally{clearTimeout(timer);if(alive.current)setPending(false);request.current=null;}}
 return <section><Button variant="secondary" loading={pending} onPress={load}>이전 게임 기록 보기</Button>{error&&<p role="alert" className="field-error">{error}</p>}{record&&<div><h3>이전 게임 기록</h3>{record.game?.status==='result'?<><SettlementPanel game={record.game}/><PublishedRounds game={record.game}/><p>{record.game.caseText}</p></>:<><p>판결 없이 중단된 게임이에요.</p>{record.interruption?.caseText&&<p>{record.interruption.caseText}</p>}</>}<Button variant="secondary" onPress={()=>setRecord(null)}>기록 접기</Button></div>}</section>;
}
