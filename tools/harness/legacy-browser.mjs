// The 75-case legacy suite measured 612s with one worker. Two sequential native
// Playwright partitions keep each finite 360s guard (total budget now 720s).
// No test timeout/retry/skip or runner maximum changes are part of this split.
export const LEGACY_BROWSER_CHECKS=Object.freeze([1,2].map(shard=>Object.freeze({
 id:`browser-launch-${shard}`,kind:'playwright',files:['node_modules/@playwright/test/cli.js'],
 args:['test','--reporter=json','--grep-invert','@e2e|@mobile',`--shard=${shard}/2`],
 timeoutMs:360000,dependsOn:'build'
})));
