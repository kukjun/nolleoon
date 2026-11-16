import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Layout, Status } from './design/components';
import { requestSession } from './api/session-client';
import { Rooms } from './rooms';
import { Gallery } from './design/gallery';
function App() {
  const [status,setStatus]=useState<'loading'|'missing'|'active'|'error'>('loading');
  const [failureMessage,setFailureMessage]=useState('서버에 연결하지 못했어요. 다시 시도해 주세요.');
  useEffect(()=>{
    let mounted=true;
    void requestSession('GET').then(async result=>{
      if(!mounted)return;
      if(result.ok) {
        const refreshed=await requestSession('POST');
        if(mounted){setStatus(refreshed.ok?'active':'error');if(!refreshed.ok)setFailureMessage(refreshed.message);}
      } else {setStatus(result.code==='SESSION_REQUIRED'?'missing':'error');setFailureMessage(result.message);}
    });
    return ()=>{mounted=false;};
  },[]);
  async function start() {
    setStatus('loading');
    const result=await requestSession('POST');
    setStatus(result.ok?'active':'error');if(!result.ok)setFailureMessage(result.message);
  }
  return <Layout><div className="home-grid"><section className="hero"><span className="eyebrow">A LITTLE COURT, JUST FOR US</span><h2>친구들 사이의<br/><em>작은 재판.</em></h2><p>가벼운 사건 하나, 서로의 이야기.<br/>우리끼리 웃으며 풀어볼까요?</p><div className="hero-illustration" aria-hidden="true"><div className="speech"><span className="speech-icon">?</span>일단, 얘기를 들어보자</div><div className="speech"><span className="speech-icon">✓</span>내 생각은 말이야…</div></div></section><div className="home-right"><section className="panel session-panel"><span className="eyebrow">START HERE</span><h2>우리의 첫 페이지</h2><p className="body-copy">방을 만들고 친구들을 초대할 수 있어요. 재판 게임 기능은 아직 준비 중입니다.</p><Status live tone={status==='active'?'success':status==='error'?'warning':'neutral'}>{status==='active'?'이 브라우저의 신원을 확인했어요.':status==='loading'?'브라우저 신원을 확인하고 있어요.':status==='error'?failureMessage:'이 브라우저로 새 신원을 시작할 수 있어요.'}</Status>
    {status!=='active'?<Button loading={status==='loading'} onPress={start}>이 브라우저로 시작</Button>:<Rooms/>}
    <div className="recovery-note"><p>쿠키를 지우거나 다른 브라우저를 쓰면 이전 신원과 기록을 복구할 수 없어요. 같은 닉네임도 복구 수단이 아니에요.</p><p>신원은 마지막 발급·갱신부터 90일간 유지돼요. 기록의 서버 보관과는 별개예요.</p></div></section><section className="panel"><div className="section-label">COMING NEXT · 예정된 플레이</div><h3>함께라서 더 재밌게</h3><ol className="howto"><li><span className="step-number">01</span><div><strong>하나의 방에 모여요</strong><small>링크를 나누고 친구들을 초대해요.</small></div></li><li><span className="step-number">02</span><div><strong>서로의 이야기를 들어요</strong><small>사건과 역할을 정하고 변론을 들어요.</small></div></li><li><span className="step-number">03</span><div><strong>생각을 모아 판결해요</strong><small>익명 투표로 각자의 의견을 전해요.</small></div></li></ol></section></div></div></Layout>;
}
const root=document.getElementById('root');
if(!root)throw new Error('앱 표시 영역을 찾지 못했습니다.');
const Screen=new URL(document.location.href).searchParams.get('view')==='design'?Gallery:App;
createRoot(root).render(<StrictMode><Screen /></StrictMode>);
