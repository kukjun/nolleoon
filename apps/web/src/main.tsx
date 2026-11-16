import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
function App() {
  const [status,setStatus]=useState<'loading'|'missing'|'active'|'error'>('loading');
  useEffect(()=>{
    let mounted=true;
    fetch('/api/session',{credentials:'same-origin',cache:'no-store'}).then(async response=>{
      if(!mounted)return;
      if(response.ok) {
        const refreshed=await fetch('/api/session',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Trip-Court-Request':'1'},body:'{}'});
        if(mounted)setStatus(refreshed.ok?'active':'error');
      } else setStatus(response.status===401?'missing':'error');
    }).catch(()=>{if(mounted)setStatus('error');});
    return ()=>{mounted=false;};
  },[]);
  async function start() {
    setStatus('loading');
    try {
      const response=await fetch('/api/session',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Trip-Court-Request':'1'},body:'{}'});
      setStatus(response.ok?'active':'error');
    } catch {setStatus('error');}
  }
  return <main>
    <h1>Trip Court</h1>
    <p>모바일 재판 게임의 개발 기반입니다. 게임 기능은 아직 준비 중입니다.</p>
    <p role="status">{status==='active'?'이 브라우저의 신원을 확인했어요.':status==='loading'?'브라우저 신원을 확인하고 있어요.':status==='error'?'서버에 연결하지 못했어요. 다시 시도해 주세요.':'이 브라우저로 새 신원을 시작할 수 있어요.'}</p>
    {status!=='active' && <button disabled={status==='loading'} onClick={()=>void start()}>이 브라우저로 시작</button>}
    <p>쿠키를 지우거나 다른 브라우저를 쓰면 이전 신원과 기록을 복구할 수 없어요. 같은 닉네임도 복구 수단이 아니에요.</p>
    <p>신원은 마지막 발급·갱신부터 90일간 유지돼요. 기록의 서버 보관과는 별개예요.</p>
  </main>;
}
const root=document.getElementById('root');
if(!root)throw new Error('앱 표시 영역을 찾지 못했습니다.');
createRoot(root).render(<StrictMode><App /></StrictMode>);
