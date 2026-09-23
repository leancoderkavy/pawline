import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { posthogScript, analyticsEvents } from '../src/posthogSetup.js';
import { capture, syncAnalyticsIdentity } from '../src/analytics.js';

function bootstrap() {
  const scripts = [];
  const context = { window: {}, document: {
    createElement: () => ({}),
    getElementsByTagName: () => [{ parentNode: { insertBefore: script => scripts.push(script) } }],
  } };
  vm.runInNewContext(posthogScript('phc_test'), context);
  return { sdk: context.window.posthog, scripts };
}

test('missing/invalid config makes no loader, valid config queues events before SDK loads', () => {
  for (const key of [undefined, '', 'personal-key', 'phc_</script>']) assert.equal(posthogScript(key), '');
  assert.equal(posthogScript('phc_test', 'https://untrusted.example'), '');
  const { sdk, scripts } = bootstrap();
  assert.equal(scripts[0].src, 'https://us-assets.i.posthog.com/static/array.js');
  sdk.capture('pet_viewed');
  assert.equal(sdk[0][0], 'capture');
  assert.equal(sdk[0][1], 'pet_viewed');
});

test('outgoing SDK events discard URL, contact, free text, and nested profile data', () => {
  const config = bootstrap().sdk._i[0][1];
  for (const key of ['autocapture', 'capture_pageview', 'capture_pageleave', 'capture_exceptions', 'capture_performance', 'capture_heatmaps', 'capture_dead_clicks', 'rageclick', 'ip']) assert.equal(config[key], false);
  assert.equal(config.disable_session_recording, true);
  assert.equal(config.advanced_disable_flags, true);
  const properties = {
    distinct_id: 'user_opaque', $anon_distinct_id: 'anonymous', token: 'phc_test',
    $current_url: 'https://example.com/?email=private@example.com',
    $referrer: 'https://example.com/private', $initial_current_url: 'private',
    email: 'private@example.com', note: 'private appointment note',
    $set: { email: 'private@example.com' }, $set_once: { $initial_referrer: 'private' },
    $exception_message: 'private', latitude: 42, pet_id: 'private',
  };
  for (const event of [...analyticsEvents, '$identify']) {
    const result = config.before_send({ event, properties });
    assert.deepEqual(JSON.parse(JSON.stringify(result.properties)), {
      distinct_id: 'user_opaque', $anon_distinct_id: 'anonymous', token: 'phc_test',
    });
  }
  for (const event of ['$autocapture', '$pageview', '$exception', 'unknown']) assert.equal(config.before_send({ event, properties }), null);
  assert.equal(config.before_send(null), null);
});

test('identity resets on logout/account switch, deduplicates effects, and never sends traits', () => {
  const calls = [];
  globalThis.window = { posthog: {
    capture: (...args) => calls.push(['capture', ...args]),
    identify: (...args) => calls.push(['identify', ...args]),
    reset: () => calls.push(['reset']),
  } };
  try {
    syncAnalyticsIdentity(null);
    syncAnalyticsIdentity(null);
    syncAnalyticsIdentity('user_a');
    syncAnalyticsIdentity('user_a');
    syncAnalyticsIdentity('user_b');
    syncAnalyticsIdentity(null);
    assert.deepEqual(calls, [
      ['reset'], ['identify', 'user_a'], ['reset'], ['identify', 'user_b'],
      ['capture', 'signed_out'], ['reset'],
    ]);
    capture('pet_viewed', { email: 'ignored@example.com' });
    assert.deepEqual(calls.at(-1), ['capture', 'pet_viewed']);
    capture('unknown');
    assert.equal(calls.length, 7);
    window.posthog.capture = () => { throw new Error('blocked'); };
    assert.doesNotThrow(() => capture('pet_viewed'));
  } finally { delete globalThis.window; }
  assert.doesNotThrow(() => capture('pet_viewed'));
});
