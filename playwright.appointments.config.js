import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export default defineConfig({
  testDir: './e2e', testMatch: 'appointments.spec.js', workers: 1, fullyParallel: false,
  timeout: 60000, expect: { timeout: 12000 }, reporter: 'list', outputDir: join(tmpdir(), 'pawline-appointments-playwright'),
  use: { baseURL: 'http://127.0.0.1:4331', viewport: { width: 1280, height: 850 }, trace: 'retain-on-failure' },
  webServer: { command: 'node e2e/chat-server.mjs', env: { PAWLINE_CHAT_PORT: '4331', PAWLINE_APPOINTMENT_FIXTURE: 'true' }, url: 'http://127.0.0.1:4331', timeout: 45000, reuseExistingServer: false },
});
