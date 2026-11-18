import {TravelLegacy} from './travel-legacy';
import {TravelProfile,type TravelAccount} from './travel-profile';
import {useEffect,useRef,useState} from 'react';
import {Button,Status} from './design/components';
import {accountSession,beginLogin,logoutAccount,safeReturnTo} from './api/travel-client';
import {travelRoute} from './travel-route';
import {TravelHome,TravelInvite,TravelRoom} from './travel-rooms';
import './travel.css';
export function TravelApp(){
 const [path,setPath]=useState(window.location.pathname);const [legacy,setLegacy]=useState(false);const [account,setAccount]=useState<TravelAccount|null>(null);const [state,setState]=useState<'loading'|'ready'|'error'>('loading');const [error,setError]=useState('');
 const generation=useRef(0);const probeAbort=useRef<AbortController|null>(null);const [epoch,setEpoch]=useState(0);const [busy,setBusy]=useState(false);const [logoutFailed,setLogoutFailed]=useState(false);const pending=useRef(false);
 const route=travelRoute(path);
 function navigate(next:string){setLegacy(false);window.history.pushState({},'',next);setPath(next);setError('');}
 function clear(){setLegacy(false);generation.current++;probeAbort.current?.abort();setAccount(null);setEpoch(x=>x+1);setState('ready');}
 async function probe(){
  const ticket=++generation.current;probeAbort.current?.abort();const controller=new AbortController();probeAbort.current=controller;const timer=setTimeout(()=>controller.abort(),6000);
  // Hide protected content until the account has been revalidated on foreground/history restore.
  setState('loading');setAccount(null);setEpoch(x=>x+1);
  try{const result=await accountSession(controller.signal);if(ticket!==generation.current)return;if(result.ok){setAccount(result.data.authenticated?result.data.account:null);setState('ready');setError('');}else if(['SESSION_REQUIRED','ACCOUNT_REQUIRED'].includes(result.code)){setState('ready');setAccount(null);setError('');}else{setState('error');setError(result.message);}}
  finally{clearTimeout(timer);}
 }
 useEffect(()=>{
  void probe();
  const pop=()=>{setLegacy(false);setPath(window.location.pathname);void probe();};const foreground=()=>{if(document.visibilityState==='visible')void probe();};const focus=()=>void probe();
  window.addEventListener('popstate',pop);window.addEventListener('pageshow',focus);window.addEventListener('focus',focus);document.addEventListener('visibilitychange',foreground);
  return()=>{generation.current++;probeAbort.current?.abort();window.removeEventListener('popstate',pop);window.removeEventListener('pageshow',focus);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',foreground);};
 },[]);
 async function login(){if(pending.current)return;pending.current=true;setBusy(true);setError('');const ticket=generation.current;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),6000);try{const result=await beginLogin(safeReturnTo(path),controller.signal);if(ticket!==generation.current)return;if(result.ok)window.location.assign(result.data.authorizationUrl);else setError(result.message);}finally{clearTimeout(timer);pending.current=false;setBusy(false);}}
 async function logout(){if(pending.current)return;pending.current=true;setBusy(true);const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),6000);try{const result=await logoutAccount(controller.signal);clear();setLogoutFailed(!result.ok);if(!result.ok)setError('이 화면의 계정 정보를 닫았지만 서버 로그아웃을 확인하지 못했어요. 다시 시도해 주세요.');}finally{clearTimeout(timer);pending.current=false;setBusy(false);}}
 const loginState=new URLSearchParams(window.location.search).get('login');
 return <div className="travel-app"><header className="travel-header"><a href="/travel" onClick={event=>{event.preventDefault();navigate('/travel');}}>Trip Court <span>여행방</span></a>{account&&state==='ready'&&<Button variant="quiet" loading={busy} onPress={logout}>로그아웃</Button>}</header><main className="travel-main">
 {error&&<p role="alert" className="field-error">{error}</p>}{logoutFailed&&<Button loading={busy} onPress={logout}>로그아웃 다시 시도</Button>}
 {state==='loading'?<Status live>계정을 확인하고 있어요…</Status>:state==='error'?<section className="travel-card"><h1>연결을 확인해 주세요</h1><Button onPress={probe}>다시 시도</Button></section>:<>
 {!account&&<section className="travel-card"><span className="eyebrow">TRAVEL TOGETHER</span><h1>{route.page==='invite'?'여행방에 초대받았어요':'우리 여행의 놀이방'}</h1><p>카카오로 로그인하고 친구들과 여행방을 함께 사용해요. 다른 기기에서도 내 여행방으로 돌아올 수 있어요.</p>{loginState==='cancelled'&&<Status live>로그인을 취소했어요. 초대는 그대로 유지돼요.</Status>}{loginState==='failed'&&<Status live tone="warning">로그인을 완료하지 못했어요. 다시 시도해 주세요.</Status>}{route.page!=='invalid'&&<Button loading={busy} onPress={login}>카카오로 로그인</Button>}<p className="travel-muted">카카오 친구 목록이나 프로필 사진을 자동으로 가져오지 않아요.</p></section>}
 {account&&((route.page==='home'&&!legacy)||route.page==='invite')&&<TravelProfile key={`${epoch}:profile`} account={account} onSaved={setAccount} onIdentityLost={clear}/>}
 {route.page==='invite'?<TravelInvite key={`${epoch}:${path}`} token={route.token} authenticated={!!account} onEntered={id=>navigate(`/travel/rooms/${id}`)} onIdentityLost={clear}/>:account&&route.page==='home'?legacy?<TravelLegacy key={epoch} onClose={()=>setLegacy(false)} onIdentityLost={clear}/>:<><TravelHome key={epoch} onOpen={id=>navigate(`/travel/rooms/${id}`)} onIdentityLost={clear}/><Button variant="secondary" onPress={()=>setLegacy(true)}>이전 브라우저 기록 연결</Button></>:account&&route.page==='room'?<TravelRoom key={`${epoch}:${path}`} roomId={route.roomId} onHome={()=>navigate('/travel')} onIdentityLost={clear}/>:route.page==='invalid'?<section className="travel-card"><h1>올바르지 않은 링크예요</h1><Button onPress={()=>navigate('/travel')}>내 여행방으로</Button></section>:null}
 </>}
 <footer className="travel-muted"><a href="/">기존 브라우저 게임으로</a></footer></main></div>;
}
