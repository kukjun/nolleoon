import { defineConfig } from '@playwright/test';
export default defineConfig({
 testIgnore:['**/travel-*.spec.mjs','**/party-*.spec.mjs','**/avatar-picker.spec.mjs'],
 testDir:'./tests/browser', fullyParallel:false, workers:1, retries:0, timeout:15000,
 reporter:'json', use:{baseURL:'http://127.0.0.1:4179', headless:true,trace:'off',screenshot:'only-on-failure'},
 webServer:{command:'node tools/harness/browser-server.mjs',url:'http://127.0.0.1:4179',reuseExistingServer:false,timeout:15000,gracefulShutdown:{signal:'SIGTERM',timeout:5000}},
});
