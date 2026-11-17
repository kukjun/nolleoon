import {expect} from '@playwright/test';
export async function openPartyGame(page,name='우리끼리 재판'){
 await page.getByRole('button',{name:'같이 할 게임 고르기',exact:true}).click();
 await page.getByRole('button',{name:new RegExp(`^${name}`)}).click();
}
export async function courtStep(page,step){
 const names=['1 게임 설정','2 역할·동의','3 시작 대기'];
 await expect(page.getByRole('button',{name:names[step-1],exact:true})).toBeEnabled();
 await page.getByRole('button',{name:names[step-1],exact:true}).click();
}
