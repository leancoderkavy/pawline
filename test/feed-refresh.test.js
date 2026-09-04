import test from "node:test";
import assert from "node:assert/strict";
import { startFeedRefresh } from "../src/feedRefresh.js";

const tick = () => new Promise(resolve => setImmediate(resolve));
function surfaces() {
  const page = new EventTarget();
  page.hidden = false;
  const network = new EventTarget();
  network.navigator = { onLine: true };
  return { page, network };
}

test("refresh deduplicates requests and cancels on teardown without publishing stale results", async () => {
  let resolve, signal, calls = 0, published = 0;
  const subscription = startFeedRefresh({ ...surfaces(),
    load: nextSignal => { signal = nextSignal; calls++; return new Promise(done => { resolve = done; }); },
    onSuccess: () => published++, onError: assert.fail,
  });
  await subscription.refresh();
  assert.equal(calls, 1);
  subscription.stop();
  assert.equal(signal.aborted, true);
  resolve({ pets: [] });
  await tick();
  assert.equal(published, 0);
});

test("refresh skips hidden and offline pages, reports failures, and can recover", async () => {
  const environment = surfaces();
  environment.page.hidden = true;
  let calls = 0, errors = 0, successes = 0;
  const subscription = startFeedRefresh({ ...environment,
    load: async () => { calls++; if (calls === 1) throw new Error("offline"); return {}; },
    onError: () => errors++, onSuccess: () => successes++,
  });
  try {
    await subscription.refresh();
    assert.equal(calls, 0);
    environment.page.hidden = false;
    environment.network.navigator.onLine = false;
    await subscription.refresh();
    assert.equal(calls, 0);
    environment.network.navigator.onLine = true;
    await subscription.refresh();
    assert.equal(errors, 1);
    await subscription.refresh();
    assert.equal(successes, 1);
  } finally { subscription.stop(); }
});
