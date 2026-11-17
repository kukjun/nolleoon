import {expect} from '@playwright/test';
// Use real production controls. Clean host re-entry explicitly reselects the existing trial.
// This UI sends selection PUT; it must never repair a different game selection or reset court data.
export async function openCourt(page, step=1, {reselectCurrentTrial=false}={}) {
 const setup=page.getByRole('region',{name:'재판 준비 단계'});
 if(!await setup.isVisible()){
  await expect(page.getByRole('button',{name:/^(작성 중인 재판 이어서 준비|선택된 게임 준비 보기|같이 할 게임 고르기)$/})).toBeVisible();
  const refreshed=page.waitForResponse(response=>/\/api\/party\/rooms\/[^/]+$/.test(new URL(response.url()).pathname)&&response.status()===200);
  await page.evaluate(()=>globalThis.dispatchEvent(new globalThis.Event('focus')));const party=await (await refreshed).json();
  expect(party.selection.type).toBe('trial');
  const resume=page.getByRole('button',{name:'작성 중인 재판 이어서 준비',exact:true});
  const guest=page.getByRole('button',{name:'선택된 게임 준비 보기',exact:true});
  if(await resume.isVisible())await resume.click();
  else if(await guest.isVisible())await guest.click();
  else {
   expect(reselectCurrentTrial,'host card selection must be explicit at the callsite').toBe(true);
   const code=new URL(page.url()).searchParams.get('room');
   const before=await (await page.request.get(`/api/rooms/${code}`)).json();
   await page.getByRole('button',{name:'같이 할 게임 고르기',exact:true}).click();
   const selected=page.waitForResponse(response=>response.url().endsWith('/selection')&&response.request().method()==='PUT');
   await page.getByRole('button',{name:/^우리끼리 재판/}).click();expect((await selected).status()).toBe(200);
   const after=await (await page.request.get(`/api/rooms/${code}`)).json();
   for(const key of ['preparationVersion','draft','roleRevision','consent'])expect(after[key],`reselect preserves ${key}`).toEqual(before[key]);
  }
 }
 const target=page.getByRole('button',{name:['1 게임 설정','2 역할·동의','3 시작 대기'][step-1],exact:true});
 await expect(target).toBeEnabled();await target.click();
}
