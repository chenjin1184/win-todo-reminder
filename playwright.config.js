const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.spec.js',
    },
  ],
});
