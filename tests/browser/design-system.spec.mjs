import { test, expect } from '@playwright/test';
const demo='/?view=design';
test('필수 입력 오류와 로딩 중 중복 실행을 구분한다',async({page})=>{
 await page.goto(demo);
 await page.getByRole('button',{name:'입력 확인'}).click();
 const field=page.getByLabel('예시 닉네임');await expect(field).toHaveAttribute('aria-invalid','true');await expect(field).toBeFocused();
 await expect(page.getByText('닉네임을 입력해 주세요.')).toBeVisible();
 await field.fill('참가자');await page.getByRole('button',{name:'입력 확인'}).click();await expect(page.getByText('입력 예시를 확인했어요. 저장되지는 않아요.')).toBeVisible();
 const button=page.getByRole('button',{name:'로딩 동작 보기'});
 await expect(button).toHaveAttribute('type','button');
 await button.evaluate(node=>{node.click();node.click();});
 await expect(page.getByRole('button',{name:'처리 중…'})).toBeDisabled();
 await expect(page.getByTestId('demo-count')).toHaveText('실행 횟수 1');
 await expect(button).toBeEnabled();
 await page.getByRole('button',{name:'실패 상태 보기'}).click();await expect(page.getByText('동작을 완료하지 못했어요. 다시 시도해 주세요.')).toBeVisible();
 await expect(page.getByRole('button',{name:'실패 상태 보기'})).toBeEnabled();
});
test('모달은 Tab을 가두고 Escape·반복 열기·상태 변경 후 포커스를 돌려준다',async({page})=>{
 await page.goto(demo);const trigger=page.getByRole('button',{name:'모달 예시 열기'});
 for(let i=0;i<2;i++) {
  await trigger.click();const dialog=page.getByRole('dialog',{name:'안내를 확인해 주세요'});await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button',{name:'닫기',exact:true})).toBeFocused();
  await page.keyboard.press('Shift+Tab');await expect(dialog.getByRole('button',{name:'상태 변경으로 닫기'})).toBeFocused();
  await page.keyboard.press('Tab');await expect(dialog.getByRole('button',{name:'닫기',exact:true})).toBeFocused();
  await page.keyboard.press('Tab');await expect(dialog.getByLabel('메모 예시')).toBeFocused();
  await page.keyboard.press('Tab');await expect(dialog.getByLabel('안내 방식')).toBeFocused();
  await page.keyboard.press('Tab');await expect(dialog.getByRole('button',{name:'확인했어요'})).toBeFocused();
  await page.keyboard.press('Tab');await expect(dialog.getByRole('button',{name:'상태 변경으로 닫기'})).toBeFocused();
  await page.keyboard.press('Tab');await expect(dialog.getByRole('button',{name:'닫기',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();
 }
 await trigger.click();await page.getByRole('button',{name:'상태 변경으로 닫기'}).click();await expect(trigger).toBeFocused();
 await trigger.click();await page.getByRole('button',{name:'닫기',exact:true}).click();await expect(trigger).toBeFocused();
});
test('320px 화면에서도 긴 텍스트·선택·상태·터치 영역이 읽힌다',async({page})=>{
 await page.setViewportSize({width:320,height:640});await page.goto(demo);
 await expect(page.getByText('연결 끊김',{exact:true})).toBeVisible();await expect(page.getByText('접수 완료',{exact:true})).toBeVisible();
 const choice=page.getByRole('radio',{name:/무죄/});await choice.check();await expect(choice).toBeChecked();
 await choice.focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('radio',{name:/기권/})).toBeChecked();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 const button=page.getByRole('button',{name:'입력 확인'});expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(48);
 await expect(page.getByRole('timer')).toHaveAttribute('aria-live','off');
 await page.setViewportSize({width:320,height:360});await page.getByLabel('예시 닉네임').focus();await button.scrollIntoViewIfNeeded();await expect(button).toBeInViewport();
});
