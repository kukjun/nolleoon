import {test,expect} from '@playwright/test';
for(const width of [320,390])for(const scale of [1,2])test(`history cards ${width}px text${scale*100}% keep readable title and usable action`,async({page})=>{
 await page.setViewportSize({width,height:844});
 await page.route('**/api/party/history',route=>route.fulfill({json:{items:['trial','draw','team'].map((type,i)=>({runId:`layout-${i}`,roomCode:'synthetic-layout',type,status:'completed'})),nextCursor:null}}));
 await page.goto('/');await page.getByRole('button',{name:'이 브라우저로 시작'}).click();await page.getByRole('button',{name:'내 게임 기록',exact:true}).click();await expect(page.locator('.party-history-list li')).toHaveCount(3);
 if(scale===2)await page.evaluate(()=>{const sizes=[...document.body.querySelectorAll('*')].map(node=>[node,parseFloat(getComputedStyle(node).fontSize)]);for(const[node,size]of sizes)node.style.fontSize=`${size*2}px`;});
 for(const row of await page.locator('.party-history-list li').all()){
  const title=await row.locator(':scope > div').boundingBox(),button=await row.getByRole('button',{name:'기록 상세 보기'}).boundingBox(),card=await row.boundingBox();
  expect(title.width).toBeGreaterThanOrEqual(120);expect(button.width).toBeGreaterThanOrEqual(44);expect(button.height).toBeGreaterThanOrEqual(44);
  expect(button.x+button.width).toBeLessThanOrEqual(card.x+card.width-12);
  expect(title.x+title.width<=button.x||title.y+title.height<=button.y).toBe(true);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await page.screenshot({path:`artifacts/history-layout/after-${width}-${scale}.png`,fullPage:true});
});
