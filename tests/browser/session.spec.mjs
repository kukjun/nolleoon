import { test, expect } from '@playwright/test';
test('실제 Secure HttpOnly 쿠키가 새로고침·재방문에 복구되고 새 브라우저와 분리된다',async({page,context,browser})=>{
 await page.goto('/');await page.getByRole('button',{name:'이 브라우저로 시작'}).click();
 await expect(page.getByRole('status')).toHaveText('이 브라우저의 신원을 확인했어요.');
 const first=(await context.cookies()).find(c=>c.name==='__Host-trip_session');
 expect(Boolean(first)).toBe(true);expect(first.httpOnly).toBe(true);expect(first.secure).toBe(true);expect(first.sameSite).toBe('Strict');expect(first.path).toBe('/');
 expect(await page.evaluate(()=>document.cookie.includes('__Host-trip_session'))).toBe(false);
 await page.reload();await expect(page.getByRole('status')).toHaveText('이 브라우저의 신원을 확인했어요.');
 await page.goto('about:blank');await page.goto('/');await expect(page.getByRole('status')).toHaveText('이 브라우저의 신원을 확인했어요.');
 expect((await context.cookies()).find(c=>c.name===first.name).value===first.value).toBe(true);
 const other=await browser.newContext();try {
  const secondPage=await other.newPage();await secondPage.goto('http://127.0.0.1:4179/');
  await expect(secondPage.getByRole('status')).toHaveText('이 브라우저로 새 신원을 시작할 수 있어요.');
  await secondPage.getByRole('button',{name:'이 브라우저로 시작'}).click();await expect(secondPage.getByRole('status')).toHaveText('이 브라우저의 신원을 확인했어요.');
  expect((await other.cookies()).find(c=>c.name===first.name).value===first.value).toBe(false);
 } finally {await other.close();}
 await context.clearCookies();await page.reload();await expect(page.getByRole('status')).toHaveText('이 브라우저로 새 신원을 시작할 수 있어요.');
 await expect(page.getByText('쿠키를 지우거나 다른 브라우저를 쓰면 이전 신원과 기록을 복구할 수 없어요. 같은 닉네임도 복구 수단이 아니에요.')).toBeVisible();
});
