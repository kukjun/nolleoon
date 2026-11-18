import {test, expect} from '@playwright/test';
import {measureMobileStage} from '../support/mobile-stage-metrics.mjs';

test('mobile measurement waits for the actual delayed stage, not the previous selection', async ({page}) => {
  await page.setContent('<button style="width:43px;height:43px">old selection</button>');
  await page.evaluate(() => { setTimeout(() => {
    document.body.innerHTML = '<main class="party-app"><button style="width:44px;height:44px">팀 나누기 시작</button><button hidden>hidden</button></main>';
  }, 150); });
  const metrics = await measureMobileStage(page, page.getByRole('button', {name:'팀 나누기 시작',exact:true}));
  expect(metrics.smallButtons).toEqual([]);
  await expect(page.getByText('old selection', {exact:true})).toHaveCount(0);
});

test('mobile measurement still detects a genuinely undersized visible control', async ({page}) => {
  await page.setContent('<main class="party-app"><button style="width:43px;height:44px">too small</button><button style="width:44px;height:44px">ready</button><button hidden>hidden</button></main>');
  const metrics = await measureMobileStage(page, page.getByRole('button', {name:'ready',exact:true}));
  expect(metrics.smallButtons).toEqual([{text:'too small',width:43,height:44}]);
});
