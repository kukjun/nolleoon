import {test,expect} from '@playwright/test';
test('redacted legacy history renders only numeric summary and deletion notice at 320px',async({page})=>{
 await page.setViewportSize({width:320,height:844});
 await page.route('**/api/party/history',r=>r.fulfill({json:{items:[{runId:'deleted-run',roomCode:'synthetic-room',type:'draw',status:'completed'}],nextCursor:null}}));
 await page.route('**/api/party/rooms/synthetic-room/runs/deleted-run',r=>r.fulfill({json:{runId:'deleted-run',type:'draw',status:'completed',version:1,participants:[],self:{eligible:false,revealed:false},settings:{teamCount:0,winnerCount:0,penaltyText:''},result:null,blockedPolicy:null,redacted:{kind:'draw',redacted:true,summary:{participantCount:3,revealed:{winnerCount:1,notWinnerCount:2}}}}}));
 await page.goto('/');await page.getByRole('button',{name:'이 브라우저로 시작'}).click();await page.getByRole('button',{name:'내 게임 기록',exact:true}).click();await page.getByRole('button',{name:'기록 상세 보기'}).click();
 await expect(page.getByRole('heading',{name:'참가자 탈퇴로 상세가 삭제됐어요'})).toBeVisible();await expect(page.getByText('공개된 제비 · 당첨 1명 · 통과 2명')).toBeVisible();await expect(page.getByText('참가 인원 · 3명')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);await page.screenshot({path:'artifacts/legacy-redacted-history/320.png',fullPage:true});
});
