import {defineConfig} from '@playwright/test';
import base from './playwright.config.mjs';
export default defineConfig({...base,timeout:20000,testIgnore:[],testMatch:['**/party-*.spec.mjs','**/avatar-picker.spec.mjs']});
