import { test, expect } from '@playwright/test';
test('Chromium이 빌드한 React 뼈대를 렌더한다', async ({page}) => {
 await page.goto('/');
 await expect(page).toHaveTitle('Trip Court');
 await expect(page.getByRole('heading',{name:'Trip Court',exact:true})).toBeVisible();
 await expect(page.getByText('친구들과 한 방에 모여요. 팀 나누기, 제비뽑기, 우리끼리 재판까지. 오늘의 한 판을 골라요.')).toBeVisible();
});
