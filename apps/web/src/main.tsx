import {TravelEntry} from './travel-entry';
import {TravelApp} from './travel-app';
import { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Layout, Status } from './design/components';
import { requestSession } from './api/session-client';
import {AuthGeneration} from './api/identity-generation';
import {PartyHistory} from './party-history';
import { Rooms } from './rooms';
import { Gallery } from './design/gallery';
function App() {
  const [joined,setJoined]=useState(false);const [showHistory,setShowHistory]=useState(false);
  const [status,setStatus]=useState<'loading'|'missing'|'active'|'error'>('loading');
  const [failureMessage,setFailureMessage]=useState('서버에 연결하지 못했어요. 다시 시도해 주세요.');
  const pendingProbe=useRef<AbortController|null>(null);
  const auth=useRef(new AuthGeneration());const probes=useRef(new AuthGeneration());const statusRef=useRef(status);statusRef.current=status;
  const [identityEpoch,setIdentityEpoch]=useState(0);const [identityLost,setIdentityLost]=useState(false);const creating=useRef(false);const hadIdentity=useRef(false);
  function loseIdentity(ticket:number){
    if(!auth.current.current(ticket))return;
    pendingProbe.current?.abort();pendingProbe.current=null;auth.current.begin();probes.current.begin();setIdentityEpoch(auth.current.value());setJoined(false);setShowHistory(false);setIdentityLost(hadIdentity.current);setStatus('missing');
  }
  const onIdentityLost=useCallback(()=>loseIdentity(identityEpoch),[identityEpoch]);
  async function probe(bootstrap=false){
    pendingProbe.current?.abort();
    const sequence=probes.current.begin();
    const ticket=bootstrap?auth.current.begin():auth.current.value();
    if(bootstrap)setIdentityEpoch(ticket);
    const request=new AbortController();pendingProbe.current=request;const timeout=setTimeout(()=>request.abort(),6000);
    try{
      let result=await requestSession('GET',fetch,request.signal);
      if(!auth.current.current(ticket)||!probes.current.current(sequence))return;
      if(result.ok){hadIdentity.current=true;result=await requestSession('RENEW',fetch,request.signal);}
      if(!auth.current.current(ticket)||!probes.current.current(sequence))return;
      if(result.ok){setStatus('active');setIdentityEpoch(ticket);}
      else if(result.code==='SESSION_REQUIRED')loseIdentity(ticket);
      else{setFailureMessage(result.message);if(statusRef.current!=='active')setStatus('error');}
    }finally{clearTimeout(timeout);if(pendingProbe.current===request)pendingProbe.current=null;}
  }
  useEffect(()=>{
    void probe(true);
    function restored(event:PageTransitionEvent){if(event.persisted)void probe();}
    window.addEventListener('pageshow',restored);
    return()=>{pendingProbe.current?.abort();pendingProbe.current=null;auth.current.begin();probes.current.begin();window.removeEventListener('pageshow',restored);};
  },[]);
  async function start(){
    if(creating.current)return;creating.current=true;
    pendingProbe.current?.abort();pendingProbe.current=null;const ticket=auth.current.begin();probes.current.begin();setIdentityEpoch(ticket);setStatus('loading');setJoined(false);setShowHistory(false);
    const request=new AbortController();const timeout=setTimeout(()=>request.abort(),6000);
    try{const result=await requestSession('POST',fetch,request.signal);if(!auth.current.current(ticket))return;
      setStatus(result.ok?'active':'error');if(result.ok){hadIdentity.current=true;setIdentityLost(false);}else setFailureMessage(result.message);
    }finally{clearTimeout(timeout);creating.current=false;}
  }
  return <div className="party-app"><Layout>{!joined&&!showHistory&&!new URL(document.location.href).searchParams.has('room')&&<TravelEntry/>}<div className={`home-grid ${joined||showHistory?'joined-room':''} ${identityLost?'identity-lost':''}`}><section className="hero"><span className="eyebrow">A LITTLE COURT, JUST FOR US</span><h2>친구들 사이의<br/><em>작은 재판.</em></h2><p>가벼운 사건 하나, 서로의 이야기.<br/>우리끼리 웃으며 풀어볼까요?</p><div className="hero-illustration" aria-hidden="true"><div className="speech"><span className="speech-icon">?</span>일단, 얘기를 들어보자</div><div className="speech"><span className="speech-icon">✓</span>내 생각은 말이야…</div></div></section><div className="home-right"><section className="panel session-panel"><div className="session-intro"><span className="eyebrow">START HERE</span><h2>기존 브라우저 게임</h2><p className="body-copy">친구들과 한 방에 모여요. 팀 나누기, 제비뽑기, 우리끼리 재판까지. 오늘의 한 판을 골라요.</p><Status live tone={status==='active'?'success':status==='error'?'warning':'neutral'}>{status==='active'?'이 브라우저의 신원을 확인했어요.':status==='loading'?'브라우저 신원을 확인하고 있어요.':status==='error'?failureMessage:'이 브라우저로 새 신원을 시작할 수 있어요.'}</Status></div>
    {identityLost&&<p role="alert" className="field-error">쿠키가 삭제되었거나 신원이 만료됐어요. 이전 게임 화면을 닫았어요. 같은 닉네임으로 복구할 수 없어요.</p>}{status!=='active'?<Button loading={status==='loading'} onPress={status==='error'?()=>probe():start}>{status==='error'?'다시 연결 확인':'이 브라우저로 시작'}</Button>:<>{showHistory&&<PartyHistory key={identityEpoch} onClose={()=>setShowHistory(false)}/>}<div hidden={showHistory}><Rooms key={identityEpoch} onJoined={setJoined} onIdentityLost={onIdentityLost}/></div>{!showHistory&&<Button variant="secondary" onPress={()=>setShowHistory(true)}>내 게임 기록</Button>}</>}
    <div className="recovery-note"><p>쿠키를 지우거나 다른 브라우저를 쓰면 이전 신원과 기록을 복구할 수 없어요. 같은 닉네임도 복구 수단이 아니에요.</p><p>신원은 마지막 발급·갱신부터 90일간 유지돼요. 기록의 서버 보관과는 별개예요.</p></div></section><section className="panel coming-next"><div className="section-label">PLAY GUIDE · 플레이 안내</div><h3>함께라서 더 재밌게</h3><ol className="howto"><li><span className="step-number">01</span><div><strong>하나의 방에 모여요</strong><small>링크를 나누고 친구들을 초대해요.</small></div></li><li><span className="step-number">02</span><div><strong>서로의 이야기를 들어요</strong><small>사건과 역할을 정하고 변론을 들어요.</small></div></li><li><span className="step-number">03</span><div><strong>생각을 모아 판결해요</strong><small>익명 투표로 각자의 의견을 전해요.</small></div></li></ol></section></div></div></Layout></div>;
}
const root=document.getElementById('root');
if(!root)throw new Error('앱 표시 영역을 찾지 못했습니다.');
const Screen=window.location.pathname.startsWith('/travel')?TravelApp:new URL(document.location.href).searchParams.get('view')==='design'?Gallery:App;
createRoot(root).render(<StrictMode><Screen /></StrictMode>);
