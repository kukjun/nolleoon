/** Synthetic route fixtures only, loopback ephemeral static server, no API process. */
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('apps/web/dist');
const server=createServer((req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;const file=path.startsWith('/assets/')?resolve(root,'.'+path):resolve(root,'index.html');if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',extname(file)==='.js'?'text/javascript':extname(file)==='.css'?'text/css':extname(file)==='.webp'?'image/webp':'text/html');res.end(readFileSync(file));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 const members=[1,2].map(n=>({membershipId:`m${n}`,nickname:n===1?'첫 사람':'둘째 사람',connected:true,isAdmin:n===1,presetId:`preset-0${n}`}));
 let active=false,completed=false,authenticated=false;
 const room=()=>({roomId:'room-a',title:'합성 여행',startDate:null,endDate:null,status:'open',version:0,self:{membershipId:'m1',isAdmin:true},members,activeRun:active?{runId:'run-a',type:'team',status:completed?'completed':'draft',facilitatorMembershipId:'m1'}:null});
 const run=()=>({runId:'run-a',roomId:'room-a',type:'team',status:completed?'completed':'draft',version:completed?1:0,facilitatorMembershipId:'m1',selectedMembershipIds:['m1','m2'],createdAt:1,startedAt:completed?2:null,endedAt:completed?2:null,isParticipant:true,game:{kind:'team',teamCount:2,assignments:completed?[{membershipId:'m1',team:1},{membershipId:'m2',team:2}]:[]}});
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==origin){await route.abort();return;}
  const p=url.pathname;if(!p.startsWith('/api/')){await route.continue();return;}
  let body;
  if(p==='/api/account/session')body={authenticated,account:{id:'account-a',displayName:'합성',presetId:'preset-01',revision:0}};
  else if(p==='/api/travel-rooms')body={items:[{...room(),isAdmin:true,memberCount:2}],nextCursor:null};
  else if(p.endsWith('/runs/run-a/start')){completed=true;body=run();}
  else if(p.endsWith('/runs/run-a'))body=run();
  else if(p==='/api/travel-rooms/room-a')body=room();
  else {await route.fulfill({status:404,json:{error:{code:'NOT_FOUND'}}});return;}
  await route.fulfill({json:body});
 });
 const out='artifacts/style-evidence/before/web';mkdirSync(out,{recursive:true});
 const capture=async name=>{await page.screenshot({path:`${out}/${name}.png`,fullPage:false});};
 await page.goto(origin+'/travel');await page.getByRole('button',{name:'카카오로 로그인'}).waitFor();await capture('00-auth');authenticated=true;
 await page.goto(origin+'/travel');await page.getByRole('button',{name:/합성 여행/}).waitFor();await capture('01-home');
 await page.getByRole('button',{name:/합성 여행/}).click();await page.getByRole('button',{name:'게임 고르기'}).waitFor();await capture('02-lobby');
 await page.getByRole('button',{name:'게임 고르기'}).click();await page.getByRole('heading',{name:'어떤 게임을 할까요?'}).waitFor();await capture('03-selection');
 active=true;await page.goto(origin+'/travel/rooms/room-a');await page.getByRole('button',{name:'진행 중인 판 보기'}).click();await page.getByRole('button',{name:'팀 나누기 시작'}).waitFor();await capture('04-team-ready');
 const styles=await page.evaluate(()=>{const button=[...globalThis.document.querySelectorAll('button')].find(x=>x.textContent.includes('팀 나누기 시작'));const read=e=>{const s=globalThis.getComputedStyle(e);return{background:s.backgroundColor,color:s.color,borderRadius:s.borderRadius,fontFamily:s.fontFamily};};return{body:read(globalThis.document.body),travel:read(globalThis.document.querySelector('.travel-app')??globalThis.document.querySelector('main')),button:read(button)};});
 writeFileSync(`${out}/computed.json`,JSON.stringify({browser:browser.version(),viewport:{width:390,height:844},...styles},null,2));
 await page.getByRole('button',{name:'팀 나누기 시작'}).click();await page.getByRole('heading',{name:'팀 나누기 결과'}).waitFor();await capture('05-team-result');
 console.log('Synthetic web evidence: six 390x844 viewport captures; external requests aborted.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
