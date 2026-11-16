import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
async function create(page){await page.goto('/');await page.getByRole('button',{name:'이 브라우저로 시작'}).click();await page.getByLabel('닉네임').fill('역할 방장');await page.getByRole('button',{name:'방 만들기',exact:true}).click();await expect(page.getByRole('heading',{name:'우리의 대기실'})).toBeVisible();}
async function join(page,url){await page.goto(url);await page.getByRole('button',{name:'이 브라우저로 시작'}).click();await page.getByLabel('닉네임').fill('역할 친구');await page.getByRole('button',{name:'방 참여하기'}).click();await expect(page.getByRole('heading',{name:'우리의 대기실'})).toBeVisible();}
test('방장도 피고가 되며 다른 참가자는 이미 선택된 피고 자리를 차지하지 못한다',async({page,browser})=>{
 await create(page);await page.getByRole('radio',{name:/^피고/}).click();await expect(page.getByRole('radio',{name:/^피고/})).toBeChecked();const context=await browser.newContext();try{const guest=await context.newPage();await join(guest,page.url());await guest.getByRole('radio',{name:/^피고/}).click();await expect(guest.getByRole('alert')).toContainText('상태가 달라졌어요');await expect(guest.getByRole('radio',{name:/^참가자/})).toBeChecked();await page.reload();await expect(page.getByRole('radio',{name:/^피고/})).toBeChecked();await page.setViewportSize({width:390,height:844});await mkdir('artifacts/roles',{recursive:true});await page.screenshot({path:'artifacts/roles/host-defendant-mobile.png',fullPage:true});}finally{await context.close();}
});
test('방장은 연결이 끊긴 참가자를 제외하고 다른 탭 재참여 후 이전 탭도 새 권한을 복구한다',async({page,browser})=>{
 test.setTimeout(45000);await create(page);const context=await browser.newContext();
 try{
  const guest=await context.newPage();await join(guest,page.url());await guest.getByRole('radio',{name:/^피고/}).click();await expect(guest.getByRole('radio',{name:/^피고/})).toBeChecked();
  const snapshot=await guest.evaluate(async()=>{const code=new URL(globalThis.location.href).searchParams.get('room');return (await fetch(`/api/rooms/${code}`)).json();});const oldMember=snapshot.self.memberId;
  await expect(page.getByTestId('member')).toHaveCount(2);await context.setOffline(true);await expect(page.getByRole('button',{name:'역할 친구 제외하기'})).toBeVisible({timeout:22000});await page.getByRole('button',{name:'역할 친구 제외하기'}).click();const modal=page.getByRole('dialog',{name:'참가자를 제외할까요?'});await expect(modal).toContainText('역할 친구');await modal.getByRole('button',{name:'취소',exact:true}).click();await expect(page.getByTestId('member')).toHaveCount(2);await page.getByRole('button',{name:'역할 친구 제외하기'}).click();await modal.getByRole('button',{name:'참가자 제외 확인'}).click();await expect(page.getByTestId('member')).toHaveCount(1);
  await context.setOffline(false);await expect(guest.getByRole('link',{name:'다시 참여하기'})).toBeVisible();await expect(guest.getByRole('radio')).toHaveCount(0);
  await context.setOffline(true);await guest.evaluate(()=>globalThis.window.dispatchEvent(new globalThis.Event('focus')));await expect(guest.getByRole('alert')).toContainText('다시 연결 중');await expect(guest.getByRole('radio')).toHaveCount(0);await expect(guest.getByRole('link',{name:'다시 참여하기'})).toBeVisible();await context.setOffline(false);
  const returning=await context.newPage();await returning.goto(page.url());await returning.getByLabel('닉네임').fill('새로운 친구');await returning.getByRole('button',{name:'방 참여하기'}).click();await expect(returning.getByTestId('member')).toHaveCount(2);await expect(returning.getByRole('radio',{name:/^참가자/})).toBeChecked();
  await guest.bringToFront();await expect(guest.getByRole('radio',{name:/^참가자/})).toBeChecked({timeout:7000});await expect(guest.getByRole('link',{name:'다시 참여하기'})).toHaveCount(0);
  const current=await guest.evaluate(async()=>{const code=new URL(globalThis.location.href).searchParams.get('room');return (await fetch(`/api/rooms/${code}`)).json();});expect(current.self.memberId).not.toBe(oldMember);expect(current.members.find(member=>member.memberId===current.self.memberId).role).toBe('participant');
 }finally{await context.close();}
});
test('고정된 명단 계약에서는 역할 입력을 잠근다 (응답 fixture)',async({page})=>{
 await create(page);await page.route('**/heartbeat',async route=>{const response=await route.fetch();const data=await response.json();data.version+=100;data.rosterEditable=false;await route.fulfill({response,json:data});});await page.getByRole('button',{name:'참가자 새로고침'}).click();await expect(page.getByRole('radio',{name:/^피고/})).toBeDisabled();await expect(page.getByRole('radio',{name:/^참가자/})).toBeDisabled();await expect(page.getByText('게임이 시작되어 역할과 참가자를 변경할 수 없어요.')).toBeVisible();
});
