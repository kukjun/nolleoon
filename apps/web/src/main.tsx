import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return <main><h1>Trip Court</h1><p>모바일 재판 게임의 개발 기반입니다. 게임 기능은 아직 준비 중입니다.</p></main>;
}
const root = document.getElementById('root');
if (!root) throw new Error('앱 표시 영역을 찾지 못했습니다.');
createRoot(root).render(<StrictMode><App /></StrictMode>);
