import { test, expect } from '@playwright/test';
test('Chromium이 빌드한 React 뼈대를 렌더한다', async ({page}) => {
 await page.goto('/');
 await expect(page).toHaveTitle('Trip Court');
 await expect(page.getByRole('heading',{name:'Trip Court',exact:true})).toBeVisible();
 await expect(page.getByText('모바일 재판 게임의 개발 기반입니다. 게임 기능은 아직 준비 중입니다.')).toBeVisible();
});
