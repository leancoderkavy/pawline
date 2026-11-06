import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { posthogScript, analyticsEvents, sdkEvents } from '../src/posthogSetup.js';
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
  assert.equal(config.capture_pageview, 'history_change');
  assert.equal(config.capture_pageleave, 'if_capture_pageview');
  for (const key of ['autocapture', 'capture_exceptions', 'capture_performance', 'capture_heatmaps', 'capture_dead_clicks', 'rageclick', 'ip']) assert.equal(config[key], false);
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
    assert.ok(!['$pageview', '$pageleave'].includes(event));
    const result = config.before_send({ event, properties });
    assert.deepEqual(JSON.parse(JSON.stringify(result.properties)), {
      distinct_id: 'user_opaque', $anon_distinct_id: 'anonymous', token: 'phc_test',
    });
  }
  for (const event of ['$autocapture', '$exception', '$rageclick', 'unknown']) assert.equal(config.before_send({ event, properties }), null);
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

test('pageview/pageleave keep path-level web analytics context without query strings or traits', () => {
  const config = bootstrap().sdk._i[0][1];
  assert.deepEqual(sdkEvents, ['$identify', '$pageview', '$pageleave']);
  const properties = {
    distinct_id: 'anon', token: 'phc_test', $session_id: 'session',
    $current_url: 'https://www.pawlineadopt.com/pets/miso?email=private@example.com#shelter?kind=foster',
    $pathname: '/pets/miso', $host: 'www.pawlineadopt.com', $referring_domain: 'www.google.com',
    $referrer: 'https://www.google.com/search?q=private', $prev_pageview_pathname: '/guides?x=1',
    $prev_pageview_duration: 12.5, $browser: 'Chrome', $os: 'Mac OS X', $device_type: 'Desktop',
    utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'launch',
    email: 'private@example.com', $set: { email: 'private@example.com' }, latitude: 42,
  };
  const expected = {
    distinct_id: 'anon', token: 'phc_test', $session_id: 'session',
    $current_url: 'https://www.pawlineadopt.com/pets/miso', $pathname: '/pets/miso',
    $host: 'www.pawlineadopt.com', $referring_domain: 'www.google.com', $prev_pageview_pathname: '/guides',
    $prev_pageview_duration: 12.5, $browser: 'Chrome', $os: 'Mac OS X', $device_type: 'Desktop',
    utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'launch',
  };
  for (const event of ['$pageview', '$pageleave']) {
    assert.deepEqual(JSON.parse(JSON.stringify(config.before_send({ event, properties }).properties)), expected);
  }
  // Custom events never gain page context.
  assert.equal(config.before_send({ event: 'search_performed', properties }).properties.$current_url, undefined);
});

test('funnel events are allowlisted', () => {
  for (const event of ['search_performed', 'pet_viewed', 'pet_favorite_added', 'application_started', 'application_submitted',
    'sign_up_completed', 'shelter_onboarding_completed', 'foster_onboarding_completed']) assert.ok(analyticsEvents.includes(event), event);
});
