import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base, testDir: './tests/compatibility',
  reporter: [['list'], ['json', { outputFile: 'docs/verification/fidelity/compatibility-results.json' }]],
  projects: ['chromium','firefox','webkit'].map(browserName => ({ name: browserName, use: { browserName: browserName as 'chromium' | 'firefox' | 'webkit' } })),
});
