import test from "node:test";
import assert from "node:assert/strict";
import { createPublicFeedCoalescer, readBoundedText, deduplicatePets } from "../api/_public-feed.js";

test("concurrent identical public requests share work, but later requests refresh", async () => {
  const run = createPublicFeedCoalescer();
  let calls = 0;
  let finish;
  const load = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  const requests = Array.from({ length: 20 }, () => run("dogs?page=1", load));
  await Promise.resolve();
  assert.equal(calls, 1);
  finish(["dog"]);
  assert.deepEqual(await Promise.all(requests), Array.from({ length: 20 }, () => ["dog"]));
  assert.equal(await run("dogs?page=1", () => ++calls), 2);
});

test("failed shared requests are removed and can recover", async () => {
  const run = createPublicFeedCoalescer();
  const load = () => { throw new Error("upstream unavailable"); };
  const results = await Promise.allSettled([run("a", load), run("a", load)]);
  assert.ok(results.every(result => result.status === "rejected"));
  assert.equal(await run("a", () => "recovered"), "recovered");
});

test("distinct queries stay independent even when the sharing map is full", async () => {
  const run = createPublicFeedCoalescer({ maxEntries: 1 });
  let finish;
  const first = run("dogs", () => new Promise(resolve => { finish = resolve; }));
  assert.equal(await run("cats", () => "cat"), "cat");
  finish("dog");
  assert.equal(await first, "dog");
});

test("bounded reading preserves multibyte text across chunks", async () => {
  const bytes = new TextEncoder().encode("pet 🐕");
  const response = new Response(new ReadableStream({ start(controller) {
    controller.enqueue(bytes.slice(0, 6));
    controller.enqueue(bytes.slice(6));
    controller.close();
  } }));
  assert.equal(await readBoundedText(response, bytes.length), "pet 🐕");
});

test("oversized streamed bodies are cancelled without trusting content length", async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(4)); },
    cancel() { cancelled = true; },
  }), { headers: { "Content-Length": "1" } });
  await assert.rejects(readBoundedText(response, 5), /size limit/);
  assert.equal(cancelled, true);
});

test("linear deduplication preserves ordering and overlapping duplicate identities", () => {
  const rows = [
    { id: "a", externalId: "1" }, { id: "a", externalId: "2" },
    { id: "b", externalId: "2" }, { id: "c", externalId: null },
    { id: "d", externalId: "" }, { id: "e" }, { id: "c", externalId: "3" },
  ];
  const expected = rows.filter((pet, index, all) => all.findIndex(item =>
    item.id === pet.id || (pet.externalId && item.externalId === pet.externalId)) === index);
  assert.deepEqual(deduplicatePets(rows), expected);
  assert.deepEqual(deduplicatePets([]), []);
});
