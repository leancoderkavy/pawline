import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
export default defineConfig({
  testDir: "./e2e", testMatch: "chat.spec.js", fullyParallel: false, workers: 1,
  timeout: 90000, expect: { timeout: 12000 }, reporter: "list",
  outputDir: join(tmpdir(), "pawline-chat-playwright"),
  use: { baseURL: "http://127.0.0.1:4317", viewport: { width: 1280, height: 850 }, trace: "retain-on-failure", launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } },
  webServer: { command: "node e2e/chat-server.mjs", url: "http://127.0.0.1:4317", timeout: 30000, reuseExistingServer: false },
});
