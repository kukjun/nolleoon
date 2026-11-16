import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
for(const size of [3,5,6])test(`${size}개 독립 브라우저가 한 방에 참여하고 단일 방장·재방문을 유지한다`,async({browser})=>{
 const contexts=[];const pages=[];
 try{
  for(let i=0;i<size;i++){const context=await browser.newContext({viewport:{width:390,height:844}});contexts.push(context);pages.push(await context.newPage());}
  const host=pages[0];await host.goto('http://127.0.0.1:4179/');await host.getByRole('button',{name:'이 브라우저로 시작'}).click();
  await host.getByLabel('닉네임').fill('방장');await host.getByRole('button',{name:'방 만들기',exact:true}).click();
  await expect(host.getByRole('heading',{name:'우리의 대기실'})).toBeVisible();const url=host.url();
  for(let i=1;i<size;i++){await pages[i].goto(url);await pages[i].getByRole('button',{name:'이 브라우저로 시작'}).click();await pages[i].getByLabel('닉네임').fill(`참가자 ${i}`);await pages[i].getByRole('button',{name:'방 참여하기'}).click();await expect(pages[i].getByRole('heading',{name:'우리의 대기실'})).toBeVisible();}
  await host.getByRole('button',{name:'참가자 새로고침'}).click();await expect(host.getByTestId('member')).toHaveCount(size);await expect(host.getByTestId('member').filter({hasText:'방장 · 나'})).toHaveCount(1);
  await pages[1].reload();await expect(pages[1].getByTestId('member')).toHaveCount(size);await expect(pages[1].getByText('나 · 참가자')).toBeVisible();
  if(size===6){await mkdir('artifacts/rooms',{recursive:true});await host.screenshot({path:'artifacts/rooms/room-mobile.png',fullPage:true});expect(await host.evaluate(()=>document.documentElement.scrollWidth<=globalThis.innerWidth)).toBe(true);}
 }finally{for(const context of contexts)await context.close();}
});
test('잘못된 초대 링크는 오류를 보이며 방을 생성하지 않는다',async({page})=>{
 await page.goto('/?room=missing');await page.getByRole('button',{name:'이 브라우저로 시작'}).click();await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('heading',{name:'우리의 대기실'})).toHaveCount(0);
});
test('중복 닉네임은 안내하고 다른 이름으로 참여할 수 있다',async({page,browser})=>{
 await page.goto('/');await page.getByRole('button',{name:'이 브라우저로 시작'}).click();await page.getByLabel('닉네임').fill('같은 이름');await page.getByRole('button',{name:'방 만들기',exact:true}).click();await expect(page.getByRole('heading',{name:'우리의 대기실'})).toBeVisible();
 const context=await browser.newContext();try{const guest=await context.newPage();await guest.goto(page.url());await guest.getByRole('button',{name:'이 브라우저로 시작'}).click();await guest.getByLabel('닉네임').fill('같은 이름');await guest.getByRole('button',{name:'방 참여하기'}).click();await expect(guest.getByRole('alert')).toHaveText('이미 사용 중인 닉네임이에요. 다른 이름을 입력해 주세요.');await guest.getByLabel('닉네임').fill('다른 이름');await guest.getByRole('button',{name:'방 참여하기'}).click();await expect(guest.getByTestId('member')).toHaveCount(2);}finally{await context.close();}
});
test('지연된 방 응답 도중 홈으로 이동하면 이전 대기실이 나타나지 않는다',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'이 브라우저로 시작'}).click();await page.getByLabel('닉네임').fill('나가기 시험');await page.getByRole('button',{name:'방 만들기',exact:true}).click();await expect(page.getByRole('heading',{name:'우리의 대기실'})).toBeVisible();const roomUrl=page.url();
 let release;const gate=new Promise(resolve=>release=resolve);let reached;const started=new Promise(resolve=>reached=resolve);
 await page.route('**/api/rooms/*',async route=>{reached();await gate;try{await route.continue();}catch{/* 페이지 이동에 따른 요청 취소 */}});
 await page.goto(roomUrl);await started;await page.getByRole('link',{name:'Trip Court 홈'}).click();release();await expect(page.getByRole('button',{name:'방 만들기',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'우리의 대기실'})).toHaveCount(0);
});
test('같은 프레임의 반복 제출은 방 생성 요청을 한 번만 보낸다',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'이 브라우저로 시작'}).click();await page.getByLabel('닉네임').fill('반복 제출');
 let posts=0;page.on('request',request=>{if(new URL(request.url()).pathname==='/api/rooms'&&request.method()==='POST')posts++;});
 await page.getByLabel('닉네임').evaluate(input=>{input.form.requestSubmit();input.form.requestSubmit();});
 await expect(page.getByRole('heading',{name:'우리의 대기실'})).toBeVisible();expect(posts).toBe(1);
});
