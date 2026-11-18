import {randomUUID} from 'node:crypto';
import {test,expect} from '@playwright/test';
const origin='http://127.0.0.1:4188';
const headers={origin,'x-trip-court-request':'1'};
async function login(context,subject){const start=await context.request.post('/api/account/login',{headers,data:{returnTo:'/travel'}});expect(start.status()).toBe(201);const state=new URL((await start.json()).authorizationUrl).searchParams.get('state');expect((await context.request.get(`/api/account/callback?state=${state}&code=synthetic-${subject}-${randomUUID().replaceAll('-','')}`)).status()).toBe(200);expect((await(await context.request.get('/api/account/session')).json()).authenticated).toBe(true);}
test('@travel-e2e UI-created room, UI invitation join, reload, game history and account relogin preserve membership',async({browser})=>{
 test.setTimeout(60000);const contexts=[];
 try{
  for(const subject of [2801,2802,2803]){const c=await browser.newContext({baseURL:origin,viewport:{width:390,height:844}});c.setDefaultTimeout(5000);contexts.push(c);await login(c,subject);}
  const [a,b,c]=contexts;const owner=await a.newPage();await owner.goto('/travel');
  await owner.getByRole('button',{name:'새 여행방 만들기',exact:true}).click();await owner.getByRole('textbox',{name:'여행 이름필수',exact:true}).fill('직접 흐름 검증 여행');await owner.getByRole('button',{name:'다음',exact:true}).click();await owner.getByRole('button',{name:'여행방 만들기',exact:true}).click();
  await expect(owner.getByRole('heading',{name:'직접 흐름 검증 여행',exact:true})).toBeVisible();const roomUrl=owner.url();const roomId=new URL(roomUrl).pathname.split('/').at(-1);const root='/api/travel-rooms/'+roomId;
  await owner.reload();await expect(owner.getByRole('heading',{name:'직접 흐름 검증 여행',exact:true})).toBeVisible();
  await owner.locator('summary').filter({hasText:'방 관리 ·'}).click();await owner.getByRole('button',{name:'새 초대 링크 발급'}).click();const invite=await owner.getByLabel('초대 링크',{exact:true}).inputValue();expect(new URL(invite).origin).toBe(origin);
  const members=[];for(const context of [b,c]){const page=await context.newPage();members.push(page);await page.goto(invite);await page.getByRole('button',{name:'여행방 참여하기',exact:true}).click();await expect(page.getByRole('heading',{name:'직접 흐름 검증 여행',exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'직접 흐름 검증 여행',exact:true})).toBeVisible();}
  await owner.reload();await expect(owner.getByRole('heading',{name:'함께하는 사람 · 3'})).toBeVisible();const original=await(await b.request.get(root)).json();const membershipId=original.self.membershipId;
  // Use the real UI for every product mutation; only identity-provider exchange is synthetic.
  await owner.getByRole('button',{name:'게임 고르기',exact:true}).click();await owner.getByRole('button',{name:/팀 나누기/}).click();await owner.getByRole('button',{name:'다음',exact:true}).click();await owner.getByRole('button',{name:'판 만들기',exact:true}).click();await owner.getByRole('button',{name:'팀 나누기 시작'}).click();await expect(owner.getByRole('heading',{name:'팀 나누기 결과'})).toBeVisible();
  await owner.reload();await owner.getByRole('button',{name:'이 여행의 게임 기록'}).click();await owner.getByRole('button',{name:/팀 나누기/}).click();await expect(owner.getByRole('heading',{name:'팀 나누기 결과'})).toBeVisible();await owner.screenshot({path:'artifacts/travel-e2e/ui-created-room-reloaded-history-390.png',fullPage:true});
  await members[0].getByRole('button',{name:'로그아웃',exact:true}).click();await expect(members[0].getByRole('button',{name:'카카오로 로그인'})).toBeVisible();expect((await b.request.get(root)).status()).toBe(401);expect((await a.request.get(root)).status()).toBe(200);
  const returning=await browser.newContext({baseURL:origin,viewport:{width:390,height:844}});returning.setDefaultTimeout(5000);contexts.push(returning);await login(returning,2802);const page=await returning.newPage();await page.goto('/travel');await page.getByRole('button',{name:/직접 흐름 검증 여행/}).click();await expect(page.getByRole('heading',{name:'함께하는 사람 · 3'})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'직접 흐름 검증 여행',exact:true})).toBeVisible();const restored=await(await returning.request.get(root)).json();expect(restored.self.membershipId).toBe(membershipId);expect(restored.members).toHaveLength(3);expect((await(await returning.request.get(root+'/history')).json()).items).toHaveLength(1);await page.screenshot({path:'artifacts/travel-e2e/ui-relogin-membership-390.png',fullPage:true});
 }finally{for(const context of contexts)await context.close().catch(()=>{});}
});
