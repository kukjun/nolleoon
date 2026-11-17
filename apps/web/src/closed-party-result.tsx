import {useEffect,useState,type ReactNode} from 'react';
import type {PartySnapshot} from '@trip-court/contracts';
import {requestParty} from './api/party-client';
import {PartyHistoryResult} from './party-history';
import {Status,Button} from './design/components';
export function ClosedPartyResult({code,legacy}:{code:string;legacy:ReactNode}){
 const [party,setParty]=useState<PartySnapshot|null>(null);const [pending,setPending]=useState(true);const [error,setError]=useState('');const [retry,setRetry]=useState(0);
 useEffect(()=>{setPending(true);setError('');let alive=true;const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),6000);void requestParty(code,undefined,abort.signal).then(result=>{if(!alive)return;if(result.ok)setParty(result.data);else setError(result.message);setPending(false);}).finally(()=>clearTimeout(timeout));return()=>{alive=false;abort.abort();clearTimeout(timeout);};},[code,retry]);
 if(pending)return <Status live>닫힌 방의 기록을 확인하고 있어요.</Status>;
 if(error)return <section><h2>방이 닫혔어요</h2><p role="alert">{error}</p><p>이 방의 결과를 확인하지 못했어요. 내 게임 기록에서 참여했던 기록을 확인할 수 있어요.</p><Button onPress={()=>setRetry(value=>value+1)}>닫힌 방 결과 다시 확인</Button></section>;
 const run=party?.run;if(!run||run.type==='trial')return legacy;
 return <section className="party-history"><h2>방이 닫혔어요</h2><p>새 게임은 시작할 수 없어요. 실제 참여한 게임의 공개 가능한 기록만 남아요.</p>{run.blockedPolicy&&<p role="alert">공개하지 않은 제비의 처리 규칙을 기다리고 있어요. 자동으로 공개하거나 완료하지 않아요.</p>}<PartyHistoryResult run={run}/><a href="/">홈으로 돌아가기</a></section>;
}
