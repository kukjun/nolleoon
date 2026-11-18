import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',testMatch:'travel-*.spec.mjs',workers:1,retries:0,timeout:15000,reporter:'list',use:{baseURL:'http://127.0.0.1:4188',headless:true},webServer:{command:'npm run dev -w @trip-court/web -- --port 4188',url:'http://127.0.0.1:4188',reuseExistingServer:false}});
