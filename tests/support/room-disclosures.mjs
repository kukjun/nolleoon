import { expect } from '@playwright/test';

// Call explicitly at the interaction that needs this panel; never globally expand UI.
export async function openRoster(page, action = 'click') {
 const summary = page.locator('summary').filter({hasText:/^초대 링크 · 참가자 \d+명$/});
 await expect(summary).toBeVisible();
 if (!(await summary.evaluate(node => node.parentElement.open))) await summary[action]();
}
export async function refreshRoster(page, action = 'click') {
 await openRoster(page, action);
 await page.getByRole('button',{name:'참가자 새로고침'})[action]();
}
export async function openGameDetails(page) {
 const summary = page.locator('summary').filter({hasText:'사건·벌칙 자세히 보기'});
 await expect(summary).toBeVisible();
 if (!(await summary.evaluate(node => node.parentElement.open))) await summary.click();
}
