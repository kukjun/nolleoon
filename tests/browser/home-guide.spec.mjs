import {test,expect} from '@playwright/test';
test('홈은 구현된 플레이 안내를 제공하고 배포 완료를 주장하지 않는다',async({page})=>{
 await page.setViewportSize({width:320,height:740});await page.goto('/');await expect(page.getByText('PLAY GUIDE · 플레이 안내',{exact:true})).toBeVisible();await expect(page.getByText('COMING NEXT · 예정된 플레이',{exact:true})).toHaveCount(0);await page.screenshot({path:'artifacts/screenshots/home-guide-320.png',fullPage:true});
});
