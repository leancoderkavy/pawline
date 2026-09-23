// Retain the existing CDN loader; no new SDK dependency or server-side delivery.
export const analyticsEvents = [
  'auth_started', 'sign_in_completed', 'sign_up_completed', 'signed_out', 'auth_error',
  'pet_viewed', 'pet_favorite_added', 'pet_favorite_removed', 'favorite_error',
  'application_submitted', 'application_error',
  'appointment_proposed', 'appointment_confirmed', 'appointment_rescheduled',
  'appointment_cancelled', 'appointment_completed', 'appointment_error', 'app_error',
];

export function posthogScript(key, host = 'https://us.i.posthog.com') {
  // Public project token only. Invalid/missing config disables all analytics.
  if (!/^phc_[a-zA-Z0-9]+$/.test(key || '') || host !== 'https://us.i.posthog.com') return '';
  return `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
window.posthog.init(${JSON.stringify(key)}, {
  api_host: ${JSON.stringify(host)}, person_profiles: 'identified_only',
  autocapture: false, capture_pageview: false, capture_pageleave: false,
  capture_exceptions: false, capture_performance: false, capture_heatmaps: false,
  capture_dead_clicks: false, rageclick: false, disable_session_recording: true,
  disable_surveys: true, advanced_disable_flags: true, ip: false,
  before_send: function(event) {
    if (!event || !${JSON.stringify([...analyticsEvents, '$identify'])}.includes(event.event)) return null;
    // Drop SDK URL/referrer/UTM/person properties too, not just custom properties.
    var clean = {};
    ['token', 'distinct_id', '$anon_distinct_id', '$device_id', '$session_id', '$window_id',
      '$lib', '$lib_version', '$is_identified', '$process_person_profile'].forEach(function(key) {
      var value = (event.properties || {})[key];
      if (['string', 'boolean', 'number'].includes(typeof value)) clean[key] = value;
    });
    event.properties = clean;
    return event;
  }
});`;
}
