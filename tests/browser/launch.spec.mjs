import { test, expect } from '@playwright/test';
test('Chromium이 빌드한 React 뼈대를 렌더한다', async ({page}) => {
 await page.goto('/');
 await expect(page).toHaveTitle('Trip Court');
 await expect(page.getByRole('heading',{name:'Trip Court',exact:true})).toBeVisible();
 await expect(page.getByText('방을 만들고 친구들을 초대할 수 있어요. 재판 게임 기능은 아직 준비 중입니다.')).toBeVisible();
});
