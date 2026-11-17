import {test,expect} from '@playwright/test';
test('홈은 구현된 플레이 안내를 제공하고 배포 완료를 주장하지 않는다',async({page})=>{
 await page.setViewportSize({width:320,height:740});await page.goto('/');await expect(page.getByText('친구들과 한 방에 모여요. 팀 나누기, 제비뽑기, 우리끼리 재판까지. 오늘의 한 판을 골라요.',{exact:true})).toBeVisible();await expect(page.getByText('COMING NEXT · 예정된 플레이',{exact:true})).toHaveCount(0);await page.screenshot({path:'artifacts/screenshots/home-guide-320.png',fullPage:true});
});
