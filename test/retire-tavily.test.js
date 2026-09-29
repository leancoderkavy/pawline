import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getHealth } from "../api/health.js";
import discoveriesHandler from "../api/discoveries.js";
import sourcesHandler from "../api/sources.js";
import seoPipelineHandler from "../api/seo-pipeline.js";

function captureResponse() {
  const result = { status: null, body: null };
  return {
    result,
    setHeader() { return this; },
    status(status) { result.status = status; return this; },
    json(body) { result.body = body; return this; },
  };
}

test("removed web search cannot appear configured or return old leads", async () => {
  const health = getHealth({ DATABASE_URL: "configured", CRON_SECRET: "configured", TAVILY_API_KEY: "configured" });
  assert.equal("tavilyDiscoveryConfigured" in health, false);
  assert.equal(health.aiSeoPipelineConfigured, false);

  const discoveries = captureResponse();
  await discoveriesHandler({ method: "GET" }, discoveries);
  assert.equal(discoveries.result.status, 200);
  assert.equal(discoveries.result.body.mode, "disabled");
  assert.deepEqual(discoveries.result.body.discoveries, []);

  const sources = captureResponse();
  await sourcesHandler({ method: "GET" }, sources);
  assert.equal(sources.result.body.sources.some(source => source.id === "tavily"), false);
});

test("SEO jobs cannot be queued without a research provider", async () => {
  const previous = process.env.SEO_PIPELINE_SECRET;
  process.env.SEO_PIPELINE_SECRET = "test-secret";
  try {
    const response = captureResponse();
    await seoPipelineHandler({ method: "POST", headers: { authorization: "Bearer test-secret" }, body: {} }, response);
    assert.equal(response.result.status, 410);
  } finally {
    if (previous === undefined) delete process.env.SEO_PIPELINE_SECRET;
    else process.env.SEO_PIPELINE_SECRET = previous;
  }
});

test("deployment does not schedule retired web search or SEO workers", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const paths = config.crons.map(cron => cron.path);
  assert.equal(paths.includes("/api/cron/discover"), false);
  assert.equal(paths.includes("/api/cron/seo-pipeline"), false);
});
