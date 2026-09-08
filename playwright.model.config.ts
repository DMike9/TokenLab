import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';
export default defineConfig({ ...base, testDir: './e2e-model', outputDir: '.cache/model-results',
    use: { ...base.use, baseURL: process.env.TOKENLAB_TEST_URL ?? base.use?.baseURL },
    workers: 1, timeout: 300000 });
