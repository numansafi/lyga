import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const e2eDataDir = path.join(os.tmpdir(), 'lyga-e2e-data');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3105',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm exec next dev -p 3105',
    url: 'http://localhost:3105',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      NEXT_PUBLIC_POSTHOG_KEY: '',
      LYGA_LOCAL_WAITLIST: 'true',
      LYGA_MVP_DIR: e2eDataDir,
      LYGA_WAITLIST_DIR: e2eDataDir,
      LYGA_SESSION_SECRET: 'e2e-local-session-secret-32-chars',
    },
  },
});
