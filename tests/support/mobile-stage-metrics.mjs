/* global document, getComputedStyle */
import {expect} from '@playwright/test';

// Wait for the intended stage, then select and measure current nodes in one
// browser turn. A locator element array can otherwise outlive a React unmount.
export async function measureMobileStage(page, ready) {
  if (ready) await expect(ready).toBeVisible();
  return page.evaluate(() => {
    const visible = node => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.visibility !== 'collapse'
        && rect.width > 0 && rect.height > 0;
    };
    const smallButtons = [...document.querySelectorAll('button')]
      .filter(visible)
      .map(node => {
        const rect = node.getBoundingClientRect();
        return {text: node.textContent, width: rect.width, height: rect.height};
      })
      .filter(rect => rect.width < 44 || rect.height < 44);
    const animated = [...document.querySelectorAll('.party-app *')].filter(node => {
      const style = getComputedStyle(node);
      return style.animationName !== 'none'
        || style.transitionDuration.split(',').some(value => parseFloat(value) > 0);
    }).length;
    return {smallButtons, animated, scrollWidth: document.documentElement.scrollWidth};
  });
}
