import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
async function create(page){await page.goto('/');await page.getByRole('button',{name:'이 브라우저로 시작'}).click();await page.getByLabel('닉네임').fill('설정 방장');await page.getByRole('button',{name:'방 만들기',exact:true}).click();await expect(page.getByRole('heading',{name:'우리의 대기실'})).toBeVisible();}
test('방장만 설정을 저장하고 참가자는 읽으며 새로고침에도 유지된다',async({page,browser})=>{
 await create(page);await expect(page.getByRole('heading',{name:'우리의 첫 페이지'})).toBeHidden();await page.getByLabel('사건',{exact:true}).fill('마지막 간식을 혼자 먹은 사건');await page.getByLabel('벌칙',{exact:true}).fill('다음 간식 준비하기');await page.getByLabel('제한 시간 (분)').fill('5');
 let posts=0;page.on('request',request=>{if(request.url().endsWith('/settings')&&request.method()==='POST')posts++;});await page.getByLabel('사건',{exact:true}).evaluate(node=>{node.form.requestSubmit();node.form.requestSubmit();});await expect(page.getByText('설정을 저장했어요.',{exact:true})).toBeVisible();expect(posts).toBe(1);
 await page.reload();await expect(page.getByLabel('사건',{exact:true})).toHaveValue('마지막 간식을 혼자 먹은 사건');await expect(page.getByLabel('제한 시간 (분)')).toHaveValue('5');await page.setViewportSize({width:390,height:844});await mkdir('artifacts/settings',{recursive:true});await page.screenshot({path:'artifacts/settings/host-mobile.png',fullPage:true});
 const guest=await browser.newContext();try{const tab=await guest.newPage();await tab.goto(page.url());await tab.getByRole('button',{name:'이 브라우저로 시작'}).click();await tab.getByLabel('닉네임').fill('설정 참가자');await tab.getByRole('button',{name:'방 참여하기'}).click();await expect(tab.getByText('마지막 간식을 혼자 먹은 사건',{exact:true})).toBeVisible();await expect(tab.getByRole('button',{name:'설정 저장',exact:true})).toHaveCount(0);}finally{await guest.close();}
});
test('두 방장 탭에서 충돌해도 작성 중인 내용은 유지하며 명시적으로 최신 설정을 불러온다',async({page,context})=>{
 await create(page);const second=await context.newPage();await second.goto(page.url());await expect(second.getByLabel('사건',{exact:true})).toBeVisible();await second.getByLabel('사건',{exact:true}).fill('내 작성 중 내용');await page.getByLabel('사건',{exact:true}).fill('다른 탭이 저장한 내용');await page.getByRole('button',{name:'설정 저장',exact:true}).click();await expect(page.getByText('설정을 저장했어요.',{exact:true})).toBeVisible();
 await second.getByRole('button',{name:'참가자 새로고침'}).click();await expect(second.getByText('다른 화면에서 새 설정이 저장됐어요. 작성 중인 내용은 유지하고 있어요.')).toBeVisible();await expect(second.getByLabel('사건',{exact:true})).toHaveValue('내 작성 중 내용');await second.getByRole('button',{name:'설정 저장',exact:true}).click();await expect(second.getByRole('alert')).toContainText('다른 화면에서 설정이 변경');await expect(second.getByLabel('사건',{exact:true})).toHaveValue('내 작성 중 내용');await expect(second.getByText('설정을 저장했어요.',{exact:true})).toHaveCount(0);
 await second.getByRole('button',{name:'작성 내용 버리고 최신 설정 불러오기'}).click();await expect(second.getByLabel('사건',{exact:true})).toHaveValue('다른 탭이 저장한 내용');await second.close();
});
test('저장 요청 실패는 미저장 상태와 입력을 보존한다',async({page})=>{
 await create(page);await page.getByLabel('사건',{exact:true}).fill('다시 저장할 내용');await page.route('**/settings',route=>route.abort('failed'));await page.getByRole('button',{name:'설정 저장',exact:true}).click();await expect(page.getByRole('alert')).toContainText('서버에 연결하지 못');await expect(page.getByLabel('사건',{exact:true})).toHaveValue('다시 저장할 내용');await expect(page.getByText('저장하지 않은 변경 사항이 있어요.')).toBeVisible();await expect(page.getByText('설정을 저장했어요.',{exact:true})).toHaveCount(0);
});
test('저장 뒤 도착한 이전 heartbeat는 저장된 설정을 되돌리지 않는다',async({page})=>{
 await create(page);let old;
 await page.route('**/heartbeat',async route=>{if(!old){const response=await route.fetch();old=await response.json();await route.fulfill({response,json:old});}else await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(old)});});
 await page.getByRole('button',{name:'참가자 새로고침'}).click();await expect.poll(()=>Boolean(old)).toBe(true);
 await page.getByLabel('사건',{exact:true}).fill('새 버전 보존');await page.getByRole('button',{name:'설정 저장',exact:true}).click();await expect(page.getByText('설정을 저장했어요.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'참가자 새로고침'}).click();await expect(page.getByLabel('사건',{exact:true})).toHaveValue('새 버전 보존');
});
