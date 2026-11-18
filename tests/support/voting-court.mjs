import {test,expect} from '@playwright/test';
import {openCourt} from './court-navigation.mjs';
import {refreshRoster} from './room-disclosures.mjs';

// All setup still uses the real UI and independent browser identities. The two
// guest journeys have no dependency on each other: do not serialize their I/O.
export async function readyVotingCourt(page,browser){
 return test.step('실제 UI: 방장 준비와 두 독립 참가자 입장·투표 시작',async()=>{
  const contexts=[];
  try {
   await page.goto('/');
   await page.getByRole('button',{name:'이 브라우저로 시작'}).click();
   await page.getByLabel('닉네임').fill('투표 방장');
   await page.getByRole('button',{name:'방 만들기',exact:true}).click();
   await openCourt(page,1,{reselectCurrentTrial:true});
   await page.getByLabel('사건',{exact:true}).fill('단체 사진 사건');
   await page.getByLabel('벌칙',{exact:true}).fill('간식 준비');
   await page.getByRole('button',{name:'설정 저장',exact:true}).click();
   await expect(page.getByText('설정을 저장했어요.',{exact:true})).toBeVisible();
   await openCourt(page,2,{reselectCurrentTrial:true});
   await page.getByRole('radio',{name:/^피고/}).click();
   await page.getByRole('button',{name:'이 벌칙에 동의',exact:true}).click();
   await expect(page.getByText('피고가 이 벌칙에 동의했어요.',{exact:true})).toBeVisible();
   const guests=await Promise.all([0,1].map(async i=>{
    const context=await browser.newContext();contexts.push(context);
    const guest=await context.newPage();
    await guest.goto(page.url());
    await guest.getByRole('button',{name:'이 브라우저로 시작'}).click();
    await guest.getByLabel('닉네임').fill(`투표 친구${i}`);
    await guest.getByRole('button',{name:'방 참여하기'}).click();
    // A clicked submit is not proof of joining. Await each actual lobby before
    // the host refresh so the parallel requests cannot leave a member behind.
    await expect(guest.getByRole('button',{name:'선택된 게임 준비 보기',exact:true})).toBeVisible();
    return {context,page:guest};
   }));
   await refreshRoster(page,'click');
   await openCourt(page,3,{reselectCurrentTrial:true});
   await page.getByRole('button',{name:'재판 시작',exact:true}).click();
   await page.getByRole('button',{name:'다 같이 투표 시작'}).click();
   for(const guest of guests)await expect(guest.page.getByRole('button',{name:'투표 제출',exact:true})).toBeVisible();
   return guests;
  }catch(error){await Promise.allSettled(contexts.map(context=>context.close()));throw error;}
 });
}
