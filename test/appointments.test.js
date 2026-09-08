import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { createChatFixture, ids, users } from '../e2e/chat-fixture.mjs';
import { normalizeAppointment, reserveVideoMinutes } from '../api/appointments.js';
import { dailyProvider, participantId } from '../api/_daily.js';
import { createDailyWebhookHandler, verifyDailyWebhook } from '../api/daily-webhook.js';
import { runAppointmentMaintenance } from '../api/cron/appointment-reminders.js';
import { appointmentCalendar } from '../src/appointmentCalendar.js';

export const environment = { PAWLINE_DAILY_ENABLED: 'true', DAILY_API_KEY: 'test-only', DAILY_DOMAIN: 'https://pawline-test.daily.co' };
const times = (offset = 3600000) => ({ startsAt: new Date(Date.now() + offset).toISOString(), minutes: 20, timeZone: 'America/Los_Angeles', kind: 'video' });
const response = () => ({ statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } });
async function setup(options = {}) {
  const providerCalls = [];
  const provider = { room: async row => { providerCalls.push(['room', row.room_name]); return `${environment.DAILY_DOMAIN}/${row.room_name}`; }, token: async (_row, user) => { providerCalls.push(['token', user.id]); return 'test-room-token'; }, close: async name => { providerCalls.push(['close', name]); } };
  const fixture = await createChatFixture({ environment, provider, ...options });
  const conversationId = (await fixture.invoke('direct-conversations', 'adopter', { method: 'POST', body: { listingId: ids.pet } })).data.conversation.id;
  const post = (user, action, row, extra = {}) => fixture.invoke('appointments', user, { method: 'POST', body: { conversationId, action, id: row.id, revision: row.revision, ...extra } });
  return { ...fixture, conversationId, post, provider, providerCalls };
}

test('appointment validation and UTC calendar preserve zones, escape content, and exclude private notes', () => {
  for (const patch of [{ startsAt: 'bad' }, { minutes: 90 }, { timeZone: 'not-a-zone' }, { note: 'a'.repeat(601) }, { kind: 'public' }]) assert.throws(() => normalizeAppointment({ ...times(), ...patch }));
  const a = { id: randomUUID(), revision: 3, kind: 'video', startsAt: '2026-11-01T09:30:00Z', endsAt: '2026-11-01T09:50:00Z', note: 'SECRET', room_name: 'SECRET' };
  const text = appointmentCalendar(a, 'Miso,猫;\nHome'.repeat(10));
  assert.match(text, /DTSTART:20261101T093000Z/); assert.match(text, /SEQUENCE:3/); assert.ok(!text.includes('SECRET'));
  assert.match(text, /Miso\\,猫\\;\\nHome/);
  assert.ok(text.split('\r\n').every(line => Buffer.byteLength(line) <= 75));
});

test('two-sided confirmation, stale revisions, private credentials, and revoked membership', async () => {
  const f = await setup();
  try {
    assert.equal((await f.invoke('appointments', null, { query: { conversationId: f.conversationId } })).statusCode, 401);
    assert.equal((await f.invoke('appointments', 'stranger', { query: { conversationId: f.conversationId } })).statusCode, 404);
    const proposal = (await f.post('adopter', 'propose', { id: randomUUID() }, times(0))).data.appointment;
    assert.equal(proposal.state, 'proposed');
    assert.equal((await f.post('adopter', 'accept', proposal)).statusCode, 409);
    assert.equal((await f.post('adopter', 'join', proposal)).statusCode, 403);
    const accepted = await f.post('shelter', 'accept', proposal); assert.equal(accepted.statusCode, 200);
    const row = accepted.data.appointment;
    assert.equal(row.canJoin, true);
    assert.equal((await f.post('adopter', 'cancel', proposal)).statusCode, 409);
    assert.equal((await f.post('teammate', 'join', row)).statusCode, 403);
    assert.equal((await f.post('adopter', 'join', row)).data.token, 'test-room-token');
    assert.equal((await f.post('shelter', 'join', row)).statusCode, 200);
    assert.equal((await f.database`SELECT reserved_minutes FROM appointment_video_budget`)[0].reserved_minutes, 60);
    const publicData = (await f.invoke('appointments', 'adopter', { query: { conversationId: f.conversationId } })).data;
    assert.ok(!JSON.stringify(publicData).includes('room_name')); assert.ok(!JSON.stringify(publicData).includes('fixture_'));
    assert.equal((await f.post('adopter', 'next_step', row, { nextStep: 'schedule_visit' })).statusCode, 422);
    await f.database`DELETE FROM organization_memberships WHERE clerk_user_id = ${users.shelter.id}`;
    assert.equal((await f.post('adopter', 'join', row)).statusCode, 404);
    assert.equal((await f.post('shelter', 'join', row)).statusCode, 404);
    assert.equal((await f.invoke('appointments', 'adopter', { query: { conversationId: f.conversationId } })).data.appointments[0].canJoin, false);
    const maintenance = await runAppointmentMaintenance(f.database, { environment, provider: f.provider });
    assert.equal(maintenance.closed, 1);
  } finally { await f.close(); }
});

test('rescheduling requires fresh acceptance; concurrent accept prevents caregiver double booking', async () => {
  const f = await setup();
  try {
    const p = (await f.post('adopter', 'propose', { id: randomUUID() }, times())).data.appointment;
    const retry = await f.post('adopter', 'propose', p, times()); assert.equal(retry.data.appointment.id, p.id);
    assert.equal((await f.post('adopter', 'propose', { id: randomUUID() }, times())).statusCode, 409);
    const c = (await f.post('shelter', 'accept', p)).data.appointment;
    const changed = (await f.post('shelter', 'reschedule', c, times(7200000))).data.appointment;
    assert.equal(changed.state, 'proposed');
    assert.equal((await f.post('shelter', 'accept', changed)).statusCode, 409);
    const secondConversation = (await f.invoke('direct-conversations', 'stranger', { method: 'POST', body: { listingId: ids.otherPet } })).data.conversation.id;
    const second = (await f.post('stranger', 'propose', { id: randomUUID() }, { ...times(7200000), conversationId: secondConversation })).data.appointment;
    const results = await Promise.all([f.post('adopter', 'accept', changed), f.post('shelter', 'accept', second, { conversationId: secondConversation })]);
    assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 409]);
    const latest = (await f.invoke('appointments', 'adopter', { query: { conversationId: f.conversationId } })).data.appointments[0];
    assert.equal((await f.post('adopter', 'cancel', latest)).data.appointment.state, 'cancelled');
  } finally { await f.close(); }
});

test('early video joins can finish safely and a conversation block closes provider access', async () => {
  const f = await setup();
  try {
    const p = (await f.post('adopter', 'propose', { id: randomUUID() }, times(300000))).data.appointment;
    const c = (await f.post('shelter', 'accept', p)).data.appointment;
    assert.equal((await f.post('adopter', 'end', c)).statusCode, 403);
    assert.equal((await f.post('adopter', 'join', c)).statusCode, 200);
    assert.equal((await f.post('adopter', 'reschedule', c, times())).statusCode, 409);
    const ended = await f.post('adopter', 'end', c); assert.equal(ended.data.appointment.state, 'completed');
    assert.equal((await f.post('shelter', 'join', ended.data.appointment)).statusCode, 403);
    const next = (await f.post('adopter', 'propose', { id: randomUUID() }, times(0))).data.appointment;
    const confirmed = (await f.post('shelter', 'accept', next)).data.appointment;
    await f.post('adopter', 'join', confirmed);
    await f.invoke('direct-conversations', 'adopter', { method: 'PATCH', body: { conversationId: f.conversationId, action: 'block' } });
    assert.equal((await f.post('shelter', 'join', confirmed)).statusCode, 409);
    assert.equal(f.providerCalls.filter(([action]) => action === 'close').length, 2);
    assert.equal((await f.invoke('appointments', 'shelter', { query: { conversationId: f.conversationId } })).data.appointments[0].canJoin, false);
  } finally { await f.close(); }
});

test('opt-in reminders discard stale revisions, respect opt-out, and send once', async () => {
  const f = await setup();
  try {
    const p = (await f.post('adopter', 'propose', { id: randomUUID() }, { ...times(), emailReminder: true })).data.appointment;
    const c = (await f.post('shelter', 'accept', p, { emailReminder: true })).data.appointment;
    await f.post('shelter', 'reminders', c, { emailReminder: false });
    const emails = [];
    const deps = { environment, provider: f.provider, resolveEmail: async id => `${id}@example.test`, sendEmail: async email => { emails.push(email); return { id: 'sent' }; } };
    const stats = await runAppointmentMaintenance(f.database, deps);
    assert.equal(stats.sent, 1); assert.equal(stats.discarded, 2); assert.equal(emails.length, 1);
    assert.equal(emails[0].to, `${users.adopter.id}@example.test`); assert.ok(!emails[0].text.includes('token'));
    await runAppointmentMaintenance(f.database, deps); assert.equal(emails.length, 1);
    await f.database`UPDATE appointment_notifications SET due_at = now() - interval '1 minute' WHERE kind = 'reminder'`;
    assert.equal((await runAppointmentMaintenance(f.database, deps)).sent, 1);
    await f.post('adopter', 'cancel', c);
    assert.equal((await runAppointmentMaintenance(f.database, deps)).sent, 1);
  } finally { await f.close(); }
});

test('video reservations enforce a conservative monthly cap, idempotently including UTC month boundaries', async () => {
  const f = await setup();
  try {
    const p = (await f.post('adopter', 'propose', { id: randomUUID() }, times())).data.appointment;
    const row = { id: p.id, revision: p.revision, starts_at: '2026-10-01T00:05:00Z', ends_at: '2026-10-01T00:25:00Z' };
    await reserveVideoMinutes(f.database, row, { PAWLINE_DAILY_MONTHLY_MINUTES: '60' });
    await reserveVideoMinutes(f.database, row, { PAWLINE_DAILY_MONTHLY_MINUTES: '60' });
    assert.deepEqual((await f.database`SELECT reserved_minutes FROM appointment_video_budget ORDER BY month`).map(r => r.reserved_minutes), [60, 60]);
    await assert.rejects(reserveVideoMinutes(f.database, { ...row, revision: 2 }, { PAWLINE_DAILY_MONTHLY_MINUTES: '60' }), error => error.statusCode === 429);
  } finally { await f.close(); }
});

test('Daily REST contract keeps rooms private, tokens scoped, and room expiry authoritative', async () => {
  const calls = [], row = { room_name: 'pawline-test-r2', starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 1200000).toISOString() };
  const provider = dailyProvider(environment, async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : null; calls.push({ url, ...options, body });
    if (options.method === 'GET') return { ok: false, status: 404 };
    return { ok: true, json: async () => url.endsWith('/meeting-tokens') ? { token: 'scoped-token' } : { privacy: body.privacy, url: `${environment.DAILY_DOMAIN}/${body.name}`, config: body.properties } };
  });
  assert.equal(await provider.room(row), `${environment.DAILY_DOMAIN}/${row.room_name}`);
  assert.equal(await provider.token(row, users.adopter), 'scoped-token');
  const room = calls[1].body, token = calls[2].body.properties;
  assert.equal(room.privacy, 'private'); assert.equal(room.properties.eject_at_room_exp, true); assert.equal(room.properties.max_participants, 2);
  assert.equal(room.properties.enforce_unique_user_ids, true); assert.equal(token.room_name, row.room_name); assert.equal(token.is_owner, false);
  assert.equal(token.eject_at_token_exp, undefined); assert.equal(token.eject_after_elapsed, undefined);
  assert.equal(token.user_id, participantId(users.adopter.id)); assert.ok(token.exp * 1000 <= Date.now() + 120000);
  assert.deepEqual(token.permissions.canAdmin, false);
});

test('signed Daily events reject tampering and replay without duplicating attendance', async () => {
  const f = await setup();
  try {
    const p = (await f.post('adopter', 'propose', { id: randomUUID() }, times(0))).data.appointment;
    const c = (await f.post('shelter', 'accept', p)).data.appointment;
    await f.post('adopter', 'join', c);
    const secret = Buffer.from('test-signing-secret').toString('base64'), timestamp = String(Math.floor(Date.now() / 1000));
    const webhook = createDailyWebhookHandler({ getDatabase: () => f.database, environment: { DAILY_WEBHOOK_SECRET: secret } });
    const signed = event => ({ 'x-webhook-timestamp': timestamp, 'x-webhook-signature': createHmac('sha256', Buffer.from(secret, 'base64')).update(`${timestamp}.${JSON.stringify(event)}`).digest('base64') });
    const event = { id: 'left-event', type: 'participant.left', payload: { room: `pawline-${c.id}-r${c.revision}`, user_id: participantId(users.adopter.id), joined_at: Date.now() / 1000 - 40, duration: 20 } };
    assert.equal(verifyDailyWebhook(event, signed(event), secret), true);
    assert.equal(verifyDailyWebhook({ ...event, id: 'tamper' }, signed(event), secret), false);
    assert.equal(verifyDailyWebhook(event, signed(event), secret, Date.now() + 3600000), false);
    for (let i = 0; i < 2; i++) { const res = response(); await webhook({ method: 'POST', body: event, headers: signed(event) }, res); assert.equal(res.statusCode, 200); }
    const joined = { ...event, id: 'joined-event', type: 'participant.joined' };
    await webhook({ method: 'POST', body: joined, headers: signed(joined) }, response());
    const attendance = await f.database`SELECT * FROM appointment_attendance`;
    assert.equal(attendance.length, 1); assert.equal(new Date(attendance[0].last_left_at) - new Date(attendance[0].first_joined_at), 20000);
    assert.equal((await f.database`SELECT count(*)::int AS n FROM appointment_webhook_events`)[0].n, 2);
    const invalid = response(); await webhook({ method: 'POST', body: event, headers: {} }, invalid); assert.equal(invalid.statusCode, 401);
    const probe = response(); await webhook({ method: 'POST', body: { test: 'test' }, headers: {} }, probe); assert.equal(probe.statusCode, 200);
  } finally { await f.close(); }
});
