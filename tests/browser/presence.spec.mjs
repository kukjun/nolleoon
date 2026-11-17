import { openRoster } from '../support/room-disclosures.mjs';
import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
async function create(page){await page.goto('/');await page.getByRole('button',{name:'이 브라우저로 시작'}).click();await page.getByLabel('닉네임').fill('연결 방장');await page.getByRole('button',{name:'방 만들기',exact:true}).click();await expect(page.getByRole('heading',{name:'우리의 대기실'})).toBeVisible();await openRoster(page);}
test('연결 실패 동안 마지막 화면을 보존하고 온라인 복귀 때 자동 회복한다',async({page,context})=>{
 await create(page);await context.setOffline(true);await page.evaluate(()=>globalThis.window.dispatchEvent(new globalThis.Event('focus')));await expect(page.locator('[role=alert][data-reconnecting=true]')).toContainText('다시 연결 중');await expect(page.getByTestId('member')).toHaveCount(1);
 await page.setViewportSize({width:390,height:844});await mkdir('artifacts/presence',{recursive:true});await page.screenshot({path:'artifacts/presence/reconnecting-mobile.png',fullPage:true});
 await context.setOffline(false);await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.getByTestId('member')).toContainText('연결됨');
});
test('자동 갱신으로 다른 참가자를 보고 연결 끊김과 재접속을 구분한다',async({page,browser})=>{
 test.setTimeout(35000);await create(page);const other=await browser.newContext();try{const guest=await other.newPage();await guest.goto(page.url());await guest.getByRole('button',{name:'이 브라우저로 시작'}).click();await guest.getByLabel('닉네임').fill('연결 친구');const joined=globalThis.performance.now();await guest.getByRole('button',{name:'방 참여하기'}).click();await expect(page.getByTestId('member')).toHaveCount(2);console.log('joinSyncMs='+Math.round(globalThis.performance.now()-joined));const disconnected=globalThis.performance.now();await other.setOffline(true);await expect(page.getByTestId('member').filter({hasText:'연결 친구'})).toContainText('연결 끊김',{timeout:22000});console.log('disconnectObservedMs='+Math.round(globalThis.performance.now()-disconnected));await other.setOffline(false);await expect(page.getByTestId('member').filter({hasText:'연결 친구'})).toContainText('연결됨',{timeout:6000});}finally{await other.close();}
});
test('낮은 버전 응답은 무시하고 숨김·포커스·복귀 이벤트로 갱신을 제어한다',async({page})=>{
 await create(page);let calls=0;let low=false;
 await page.route('**/heartbeat',async route=>{const response=await route.fetch();const data=await response.json();calls++;data.version=low?1:100;data.members[0].nickname=low?'오래된 이름':'최신 이름';await route.fulfill({response,json:data});});
 await page.evaluate(()=>globalThis.window.dispatchEvent(new globalThis.Event('focus')));await expect(page.getByTestId('member')).toContainText('최신 이름');low=true;await page.evaluate(()=>globalThis.window.dispatchEvent(new globalThis.Event('focus')));await expect.poll(()=>calls).toBeGreaterThanOrEqual(2);await expect(page.getByTestId('member')).not.toContainText('오래된 이름');
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new globalThis.Event('visibilitychange'));});const before=calls;await page.waitForTimeout(3300);expect(calls).toBe(before);
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new globalThis.Event('visibilitychange'));});await expect.poll(()=>calls).toBeGreaterThan(before);
});
test('멈춘 heartbeat를 제한 시간 뒤 중단하고 재시도하며 클라이언트 시계에 의존하지 않는다',async({page})=>{
 test.setTimeout(18000);await create(page);let calls=0;
 await page.route('**/heartbeat',async route=>{calls++;expect(route.request().postDataJSON()).toEqual({});if(calls===1)return;await route.continue();});
 await page.evaluate(()=>{Date.now=()=>0;globalThis.window.dispatchEvent(new globalThis.Event('focus'));});
 await expect(page.getByRole('alert')).toContainText('다시 연결 중',{timeout:8000});await expect(page.getByTestId('member')).toHaveCount(1);
 await expect(page.getByRole('alert')).toHaveCount(0,{timeout:6000});expect(calls).toBeGreaterThanOrEqual(2);await expect(page.getByTestId('member')).toContainText('연결됨');
});
