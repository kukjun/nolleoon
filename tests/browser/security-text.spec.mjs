import { refreshRoster } from '../support/room-disclosures.mjs';
import {test,expect} from '@playwright/test';
const caseText='<script>globalThis.xssCase=1</script> 사건';
const penaltyText='<img src=x onerror="globalThis.xssPenalty=1"> 벌칙';
const defenseText='<svg onload="globalThis.xssDefense=1">변론</svg>';
const reasonText='<img src=x onerror="globalThis.xssReason=1"> 투표 이유';
async function ready(page,browser){
 await page.goto('/');await page.getByRole('button',{name:'이 브라우저로 시작'}).click();await page.getByLabel('닉네임').fill('투표 방장');await page.getByRole('button',{name:'방 만들기',exact:true}).click();await page.getByLabel('사건',{exact:true}).fill(caseText);await page.getByLabel('벌칙',{exact:true}).fill(penaltyText);await page.getByRole('button',{name:'설정 저장',exact:true}).click();await expect(page.getByText('설정을 저장했어요.',{exact:true})).toBeVisible();await page.getByRole('radio',{name:/^피고/}).click();await page.getByRole('button',{name:'이 벌칙에 동의',exact:true}).click();await expect(page.getByText('피고가 이 벌칙에 동의했어요.',{exact:true})).toBeVisible();const guests=[];
 for(let i=0;i<2;i++){const context=await browser.newContext();const guest=await context.newPage();await guest.goto(page.url());await guest.getByRole('button',{name:'이 브라우저로 시작'}).click();await guest.getByLabel('닉네임').fill(`투표 친구${i}`);await guest.getByRole('button',{name:'방 참여하기'}).click();guests.push({context,page:guest});}
 await refreshRoster(page, 'click');await page.getByRole('button',{name:'재판 시작',exact:true}).click();await page.getByLabel('내 변론',{exact:true}).fill(defenseText);await page.getByRole('button',{name:'변론 제출',exact:true}).click();await expect(page.getByText(defenseText,{exact:true})).toBeVisible();await page.getByRole('button',{name:'다 같이 투표 시작'}).click();for(const guest of guests)await expect(guest.page.getByRole('button',{name:'투표 제출',exact:true})).toBeVisible();return guests;
}
test('실제 저장된 사건·벌칙·변론·투표 이유의 HTML은 문자로 표시되고 실행되지 않는다',async({page,browser})=>{
 const guests=await ready(page,browser);try{
 for(const guest of guests){await guest.page.getByText('사건·벌칙 자세히 보기',{exact:true}).click();await guest.page.getByText('변론 확인',{exact:true}).click();await expect(guest.page.locator('dd').getByText(caseText,{exact:true})).toBeVisible();await expect(guest.page.getByText(penaltyText,{exact:true})).toBeVisible();await expect(guest.page.getByText(defenseText,{exact:true})).toBeVisible();await guest.page.getByRole('radio',{name:'유죄',exact:true}).click();await guest.page.getByLabel('투표 이유',{exact:true}).fill(reasonText);await guest.page.getByRole('button',{name:'투표 제출',exact:true}).click();}
 await expect(page.getByRole('heading',{name:'수행할 벌칙',exact:true})).toBeVisible();await expect(page.getByText(reasonText,{exact:true})).toHaveCount(2);await page.getByText('사건·방 정보 보기',{exact:true}).click();await expect(page.getByText(caseText,{exact:true})).toBeVisible();for(const current of [page,...guests.map(guest=>guest.page)]){expect(await current.evaluate(()=>[globalThis.xssCase,globalThis.xssPenalty,globalThis.xssDefense,globalThis.xssReason])).toEqual([undefined,undefined,undefined,undefined]);await expect(current.locator('img[src="x"],svg[onload],script:not([src]):not([type])')).toHaveCount(0);}
 }finally{for(const guest of guests)await guest.context.close();}
});
