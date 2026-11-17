import {openCourt} from '../support/court-navigation.mjs';
import { refreshRoster } from '../support/room-disclosures.mjs';
import {test,expect} from '@playwright/test';
test.use({trace:'retain-on-failure'});

// All mutations below use the real UI. HTTP reads inspect privacy/invariants only.
async function join(browser,url,nickname){
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();
 try{await page.goto(url);await page.getByRole('button',{name:'이 브라우저로 시작'}).click();await page.getByLabel('닉네임').fill(nickname);await page.getByRole('button',{name:'방 참여하기'}).click();await expect(page.getByRole('heading',{name:/^(우리의 대기실|변론 중|투표 중|최후 변론)$/})).toBeVisible();return {context,page,nickname};}catch(error){await context.close();throw error;}
}
async function room(browser,count=5){
 const actors=[];
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();actors.push({context,page,nickname:'종합 방장'});
  await page.goto('/');await page.getByRole('button',{name:'이 브라우저로 시작'}).click();await page.getByLabel('닉네임').fill('종합 방장');await page.getByRole('button',{name:'방 만들기',exact:true}).click();await expect(page.getByRole('heading',{name:'우리의 대기실'})).toBeVisible();
  for(let i=1;i<count;i++)actors.push(await join(browser,page.url(),`종합 친구 ${i}`));
  await refreshRoster(page, 'click');await expect(page.getByTestId('member')).toHaveCount(count);
  return actors;
 }catch(error){await dispose(actors);throw error;}
}
async function dispose(actors){for(const actor of actors)await actor.context.close();}
async function snapshot(page){const code=new URL(page.url()).searchParams.get('room');return page.evaluate(async code=>{const response=await fetch(`/api/rooms/${encodeURIComponent(code)}`);return {status:response.status,data:await response.json()};},code);}
async function start(actors,defendantIndex,caseText){
 const host=actors[0].page;const defendant=actors[defendantIndex].page;
 await openCourt(host,1,{reselectCurrentTrial:true});await host.getByLabel('사건',{exact:true}).fill(caseText);await openCourt(host,1,{reselectCurrentTrial:true});await host.getByLabel('벌칙',{exact:true}).fill('다음 간식 준비');await host.getByRole('button',{name:'설정 저장',exact:true}).click();await expect(host.getByText('설정을 저장했어요.',{exact:true})).toBeVisible();
 await openCourt(defendant,2,{reselectCurrentTrial:true});await defendant.getByRole('radio',{name:/^피고/}).click();await defendant.getByRole('button',{name:'이 벌칙에 동의',exact:true}).click();await expect(defendant.getByText('피고가 이 벌칙에 동의했어요.',{exact:true})).toBeVisible();await refreshRoster(host, 'click');await openCourt(host,3,{reselectCurrentTrial:true});await host.getByRole('button',{name:'재판 시작',exact:true}).click();
 await defendant.getByLabel('내 변론',{exact:true}).fill(`${caseText}에 대한 첫 변론`);await defendant.getByRole('button',{name:'변론 제출',exact:true}).click();await expect(defendant.locator('.defense-text')).toHaveText(`${caseText}에 대한 첫 변론`);await expect(host.locator('.defense-text')).toHaveText(`${caseText}에 대한 첫 변론`);await host.getByRole('button',{name:'다 같이 투표 시작'}).click();
 for(const [index,actor]of actors.entries())if(index!==defendantIndex)await expect(actor.page.getByRole('button',{name:'투표 제출',exact:true})).toBeVisible();
 return actors.filter((_,index)=>index!==defendantIndex);
}
async function cast(actor,choice,reason){await actor.page.getByRole('radio',{name:choice,exact:true}).click();if(reason)await actor.page.getByLabel('투표 이유',{exact:true}).fill(reason);await actor.page.getByRole('button',{name:'투표 제출',exact:true}).click();}
async function ballots(voters,choices,prefix){for(let i=0;i<voters.length;i++){await cast(voters[i],choices[i],choices[i]==='기권'?'':`${prefix} 판단 ${i}`);if(i<voters.length-1)await expect(voters[i].page.getByText('내 투표가 접수됐어요.')).toBeVisible();}}
async function leave(actor){await actor.page.getByRole('button',{name:'방 나가기',exact:true}).click();await actor.page.getByRole('button',{name:'나가기 확인',exact:true}).click();await expect(actor.page.getByRole('heading',{name:'방에서 나왔어요'})).toBeVisible();}

 test('@e2e 다섯 브라우저: 유죄·비공개 투표·연속판·방장 피고·최후 변론·재동률 무죄·개인 기록',async({browser})=>{
 test.setTimeout(90000);const actors=await room(browser);let newcomer;
 try{
  const host=actors[0].page;const firstVoters=await start(actors,1,'첫 여행 약속 사건');const initial=(await snapshot(host)).data;expect(new Set((await Promise.all(actors.map(actor=>snapshot(actor.page)))).map(view=>view.data.self.memberId)).size).toBe(5);const membership=initial.members.map(member=>member.memberId).sort();
  await cast(firstVoters[0],'유죄','아직 공개되면 안 되는 첫 판단');await expect(firstVoters[0].page.getByText('내 투표가 접수됐어요.')).toBeVisible();
  for(const actor of actors.filter(actor=>actor!==firstVoters[0])){await expect(actor.page.getByText('아직 공개되면 안 되는 첫 판단',{exact:true})).toHaveCount(0);const view=(await snapshot(actor.page)).data;expect(view.game.settlement).toBeNull();expect(view.game.publishedRounds).toEqual([]);expect(view.game.ownVote).toBeNull();}
  await Promise.all(firstVoters.slice(1).map((actor,index)=>cast(actor,['유죄','유죄','무죄'][index],`첫 게임 동시 판단 ${index}`)));
  for(const actor of actors)await expect(actor.page.getByRole('region',{name:'집계 결과'}).getByRole('heading',{name:'유죄',exact:true})).toBeVisible();
  const completed=(await snapshot(host)).data;for(const reason of completed.game.publishedRounds[0].reasons)expect(Object.keys(reason).sort()).toEqual(['choice','reason']);await host.setViewportSize({width:320,height:844});await host.screenshot({path:'artifacts/screenshots/e2e-first-guilty-320.png',fullPage:true});
  newcomer=await join(browser,host.url(),'완료 후 새 친구');await expect(newcomer.page.getByText('첫 여행 약속 사건',{exact:true})).toHaveCount(0);expect((await snapshot(newcomer.page)).data.game).toBeNull();await newcomer.page.getByRole('button',{name:'내 게임 기록',exact:true}).click();await expect(newcomer.page.getByText('아직 참여한 게임 기록이 없어요.')).toBeVisible();await newcomer.page.getByRole('button',{name:'기록 닫고 돌아가기'}).click();await leave(newcomer);await newcomer.context.close();newcomer=null;
  await host.getByRole('button',{name:'다음 게임 준비',exact:true}).click();await host.getByRole('button',{name:'다음 게임 준비 확인',exact:true}).click();await expect(host.getByLabel('사건',{exact:true})).toHaveValue('');
  const secondVoters=await start(actors,0,'두 번째 여행 약속 사건');await ballots(secondVoters,['유죄','유죄','무죄','무죄'],'재투표 전');await expect(host.getByRole('heading',{name:'최후 변론과 2차 투표 준비'})).toBeVisible();await expect(host.getByLabel('내 변론',{exact:true})).toHaveValue('');await host.getByRole('button',{name:'이전 라운드 결과·이유',exact:true}).click();await expect(host.getByRole('region',{name:'1차 공개 투표 이유'})).toContainText('재투표 전 판단 0');await host.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();
  await host.getByLabel('내 변론',{exact:true}).fill('새로운 최후 변론으로 다시 판단해 주세요.');await host.getByRole('button',{name:'변론 제출',exact:true}).click();await expect(host.locator('.defense-text')).toHaveText('새로운 최후 변론으로 다시 판단해 주세요.');await host.getByRole('button',{name:'다 같이 투표 시작'}).click();for(const actor of secondVoters)await expect(actor.page.getByRole('button',{name:'투표 제출',exact:true})).toBeVisible();
  await cast(secondVoters[0],'유죄','두 번째 투표의 비공개 판단');await expect(secondVoters[0].page.getByText('내 투표가 접수됐어요.')).toBeVisible();await expect(host.getByText('두 번째 투표의 비공개 판단',{exact:true})).toHaveCount(0);await host.getByRole('button',{name:'이전 라운드 결과·이유',exact:true}).click();await expect(host.getByRole('region',{name:'1차 공개 투표 이유'})).toContainText('재투표 전 판단 0');await host.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();await ballots(secondVoters.slice(1),['유죄','무죄','무죄'],'재투표 후');
  for(const actor of actors){await expect(actor.page.getByRole('region',{name:'집계 결과'}).getByRole('heading',{name:'무죄',exact:true})).toBeVisible();await expect(actor.page.getByText('수행할 벌칙이 없어요.',{exact:true})).toBeVisible();}
  const final=(await snapshot(host)).data;expect(final.game.gameId).not.toBe(initial.game.gameId);expect(final.members.map(member=>member.memberId).sort()).toEqual(membership);expect(final.game.settlement.roundNumber).toBe(2);await expect(host.getByText('2차 투표도 동률이라 무죄로 마무리했어요.',{exact:true})).toBeVisible();await host.screenshot({path:'artifacts/screenshots/e2e-second-acquitted-320.png',fullPage:true});
  await host.getByRole('button',{name:'내 게임 기록',exact:true}).click();await expect(host.locator('.party-history-list').getByRole('listitem')).toHaveCount(2);await host.locator('.party-history-list').getByRole('listitem').last().getByRole('button').click();await expect(host.getByRole('region',{name:'게임 기록 상세'})).toContainText('첫 여행 약속 사건');await expect(host.getByRole('region',{name:'게임 기록 상세'})).toContainText('유죄');
 }finally{await newcomer?.context.close();await dispose(actors);}
});

test('@e2e 다섯 명에서 여섯 명: 오프라인 복구·관전·임의 방장 승계·피고 퇴장·모두 퇴장 후 폐쇄',async({browser})=>{
 test.setTimeout(90000);const actors=await room(browser);let observer,outsider;
 try{
  const host=actors[0].page;await start(actors,1,'중단 전 비공개 사건');const guest=actors[2];await cast(guest,'유죄','연결이 끊겨도 보존될 접수');await expect(guest.page.getByText('내 투표가 접수됐어요.')).toBeVisible();const deadline=await guest.page.getByTestId('vote-deadline').getAttribute('data-deadline');await guest.context.setOffline(true);await guest.page.evaluate(()=>globalThis.window.dispatchEvent(new globalThis.Event('focus')));await expect(guest.page.locator('[role=alert][data-reconnecting=true]')).toContainText('다시 연결 중');await expect(guest.page.getByText('내 투표가 접수됐어요.')).toBeVisible();await guest.context.setOffline(false);await guest.page.reload();await expect(guest.page.getByText('내 투표가 접수됐어요.')).toBeVisible();await expect(guest.page.getByTestId('vote-deadline')).toHaveAttribute('data-deadline',deadline);
  observer=await join(browser,host.url(),'여섯 번째 관전자');await expect(observer.page.getByTestId('game-role')).toHaveText('내 게임 역할 · 관전자');await expect(observer.page.getByRole('button',{name:'투표 제출',exact:true})).toHaveCount(0);const before=(await snapshot(host)).data;const defendantId=before.members.find(member=>member.role==='defendant').memberId;await leave(actors[0]);const remaining=[...actors.slice(1),observer];const views=await Promise.all(remaining.map(actor=>snapshot(actor.page)));const hostId=views[0].data.members.find(member=>member.isHost).memberId;expect(views[0].data.members.filter(member=>member.isHost)).toHaveLength(1);expect(hostId).not.toBe(before.self.memberId);expect(views[0].data.members.find(member=>member.memberId===defendantId).role).toBe('defendant');const successor=remaining[views.findIndex(view=>view.data.self.isHost)];await refreshRoster(successor.page, 'click');await expect(successor.page.getByText('나 · 방장',{exact:true})).toBeVisible();
  await leave(actors[1]);for(const actor of [actors[2],actors[3],actors[4],observer]){await expect(actor.page.getByRole('heading',{name:'재판이 중단됐어요'})).toBeVisible();await expect(actor.page.getByText('중단 전 비공개 사건',{exact:true})).toHaveCount(0);await expect(actor.page.getByText('연결이 끊겨도 보존될 접수',{exact:true})).toHaveCount(0);expect((await snapshot(actor.page)).data.game).toBeNull();}
  await guest.page.screenshot({path:'artifacts/screenshots/e2e-private-interruption-390.png',fullPage:true});const url=host.url();for(const actor of [actors[2],actors[3],actors[4],observer])await leave(actor);
  outsider=await browser.newContext();const fresh=await outsider.newPage();await fresh.goto(url);await fresh.getByRole('button',{name:'이 브라우저로 시작'}).click();await expect(fresh.getByRole('alert')).toContainText('이미 닫힌 방');await expect(fresh.getByLabel('닉네임')).toHaveCount(0);await expect(fresh.getByText('중단 전 비공개 사건',{exact:true})).toHaveCount(0);
 }finally{await outsider?.close();await observer?.context.close();await dispose(actors);}
});

test('@e2e 세 브라우저 전원 기권은 판결 없음이고 실제 작성한 기권 이유만 기록된다',async({browser})=>{
 test.setTimeout(60000);const actors=await room(browser,3);
 try{const host=actors[0].page;const voters=await start(actors,0,'세 명의 기권 사건');await cast(voters[0],'기권','판단 자료가 충분하지 않아요.');await expect(voters[0].page.getByText('내 투표가 접수됐어요.')).toBeVisible();await cast(voters[1],'기권','');for(const actor of actors)await expect(actor.page.getByRole('region',{name:'집계 결과'}).getByRole('heading',{name:'판결 없음',exact:true})).toBeVisible();await expect(host.getByText('수행할 벌칙이 없어요.',{exact:true})).toBeVisible();await expect(host.getByRole('region',{name:'1차 공개 투표 이유'}).locator('li')).toHaveCount(1);const result=(await snapshot(host)).data;expect(result.game.settlement).toMatchObject({guilty:0,notGuilty:0,abstain:2,total:2,outcome:'no-verdict'});await host.reload();await host.getByRole('button',{name:'내 게임 기록',exact:true}).click();await host.getByRole('button',{name:'기록 상세 보기'}).click();await expect(host.getByRole('region',{name:'게임 기록 상세'})).toContainText('판단 자료가 충분하지 않아요.');await host.screenshot({path:'artifacts/screenshots/e2e-abstention-history-390.png',fullPage:true});}finally{await dispose(actors);}
});
