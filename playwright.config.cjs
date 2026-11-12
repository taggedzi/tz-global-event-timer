const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4173', locale: 'en-GB', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', testMatch: ['links.spec.cjs', 'date-time-picker.spec.cjs'], use: { browserName: 'firefox' } },
    { name: 'webkit', testMatch: 'links.spec.cjs', use: { browserName: 'webkit' } }
  ],
  webServer: { command: 'node scripts/serve.cjs', url: 'http://127.0.0.1:4173', timeout: 15000, reuseExistingServer: false }
});
