import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default defineConfig({
  testDir: "./e2e", testMatch: "app-controls.spec.js", workers: 1,
  timeout: 30000, expect: { timeout: 8000 }, reporter: "list",
  outputDir: join(tmpdir(), "pawline-app-controls"),
  use: { baseURL: "http://127.0.0.1:3112", trace: "retain-on-failure" },
  webServer: {
    command: "npm run start -- --port 3112", url: "http://127.0.0.1:3112",
    reuseExistingServer: false, timeout: 30000,
  },
});
