import {useEffect,useRef,useState} from 'react';
import type {PersonalHistoryItem,PersonalHistoryDetail} from '@trip-court/contracts';
import {Button,Status} from './design/components';
import {requestHistoryList,requestHistoryDetail} from './api/history-client';
import {SettlementPanel} from './settlement-panel';
import {PublishedRounds} from './published-rounds';
export function PersonalHistory({onClose}:{onClose:()=>void}){
 const [items,setItems]=useState<PersonalHistoryItem[]>([]);const [cursor,setCursor]=useState<string|null>(null);const [loaded,setLoaded]=useState(false);const [pending,setPending]=useState(false);const [error,setError]=useState('');const [detail,setDetail]=useState<PersonalHistoryDetail|null>(null);
 const request=useRef<AbortController|null>(null);const sequence=useRef(0);const alive=useRef(true);
 async function load(gameId?:string,next?:string){
  request.current?.abort();const abort=new AbortController();request.current=abort;const current=++sequence.current;setPending(true);setError('');if(gameId)setDetail(null);const timer=setTimeout(()=>abort.abort(),6000);
  try{if(gameId){const result=await requestHistoryDetail(gameId,abort.signal);if(!alive.current||sequence.current!==current)return;if(result.ok)setDetail(result.data);else setError(result.message);}
   else{const result=await requestHistoryList(next,abort.signal);if(!alive.current||sequence.current!==current)return;if(result.ok){setItems(previous=>next?[...previous,...result.data.items.filter(item=>!previous.some(old=>old.gameId===item.gameId))]:result.data.items);setCursor(result.data.nextCursor);setLoaded(true);}else setError(result.message);}
  }finally{clearTimeout(timer);if(alive.current&&sequence.current===current)setPending(false);}
 }
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;sequence.current++;request.current?.abort();};},[]);
 return <section className="room-content personal-history"><h2>내 게임 기록</h2><p className="field-hint">이 브라우저 신원으로 참여한 게임만 보여요. 쿠키가 사라지면 같은 닉네임으로도 복구할 수 없어요. 방을 닫아도 기록이 자동 삭제되지는 않아요. 다른 브라우저·기기에서 복구할 수 없고, 기록 영구 보관을 보장하지 않아요.</p><Button variant="secondary" onPress={onClose}>기록 닫고 돌아가기</Button>{pending&&<Status live>기록을 확인하고 있어요.</Status>}{error&&<p role="alert" className="field-error">{error}</p>}{!loaded&&!pending&&<Button onPress={()=>load()}>기록 다시 불러오기</Button>}{loaded&&items.length===0&&<p>아직 참여한 게임 기록이 없어요.</p>}<ul className="room-members">{items.map(item=><li key={item.gameId}><div><strong>{item.caseText??'공개되지 않은 사건'}</strong><p>{item.state==='ongoing'?'진행 중':item.state==='interrupted'?'중단됨':item.outcome==='guilty'?'유죄':item.outcome==='not-guilty'?'무죄':item.outcome==='no-verdict'?'판결 없음':'완료 · 판정 기록 확인 필요'}</p><Button variant="secondary" disabled={pending} onPress={()=>load(item.gameId)}>기록 상세 보기</Button></div></li>)}</ul>{cursor&&<Button disabled={pending} onPress={()=>load(undefined,cursor)}>기록 더 보기</Button>}{detail&&<section aria-label="게임 기록 상세"><h3>게임 기록 상세</h3>{detail.ongoing?<><Status>진행 중인 게임이에요. 아직 판결이나 투표 이유를 공개하지 않아요.</Status><p>{detail.ongoing.caseText}</p></>:detail.game?.status==='result'?<><SettlementPanel game={detail.game}/><PublishedRounds game={detail.game}/><h4>사건</h4><p>{detail.game.caseText}</p></>:<><Status>판결 없이 중단된 게임이에요.</Status>{detail.interruption?.caseText?<p>{detail.interruption.caseText}</p>:<p>이 중단 기록의 사건 내용은 표시하지 않아요.</p>}</>}<Button variant="secondary" onPress={()=>setDetail(null)}>상세 닫기</Button></section>}</section>;
}
