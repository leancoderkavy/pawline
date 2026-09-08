import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createChatFixture, ids, users } from '../e2e/chat-fixture.mjs';
import { runAppointmentMaintenance } from '../api/cron/appointment-reminders.js';

const environment = { PAWLINE_DAILY_ENABLED: 'true', DAILY_API_KEY: 'fixture-only', DAILY_DOMAIN: 'https://pawline-test.daily.co' };
const times = (offset = 3600000) => ({ startsAt: new Date(Date.now() + offset).toISOString(), minutes: 20, timeZone: 'America/Los_Angeles', kind: 'video' });
async function fixture() {
  const calls = [], emails = [];
  const provider = { room: async row => { calls.push('room'); return `${environment.DAILY_DOMAIN}/${row.room_name}`; }, token: async () => { calls.push('token'); return 'fixture-token'; }, close: async () => { calls.push('close'); } };
  const f = await createChatFixture({ environment, provider });
  const conversationId = (await f.invoke('direct-conversations', 'adopter', { method: 'POST', body: { listingId: ids.pet } })).data.conversation.id;
  const post = (user, action, row, extra = {}) => f.invoke('appointments', user, { method: 'POST', body: { action, conversationId, id: row.id, revision: row.revision, ...extra } });
  const confirmed = async (offset = 3600000) => { const p = await post('adopter', 'propose', { id: randomUUID() }, times(offset)); return (await post('shelter', 'accept', p.data.appointment)).data.appointment; };
  const emailDeps = { environment, provider, resolveEmail: async id => `${id}@example.test`, sendEmail: async message => { emails.push(message); return { id: 'sent' }; } };
  return { ...f, conversationId, post, confirmed, provider, calls, emails, emailDeps };
}

test('a caregiver cannot double-book as an adopter in another conversation', async () => {
  const f = await fixture();
  try {
    const first = await f.confirmed();
    await f.database`UPDATE pets SET organization_id = NULL, claimed_by_clerk_user_id = ${users.stranger.id} WHERE id = ${ids.otherPet}`;
    const other = (await f.invoke('direct-conversations', 'shelter', { method: 'POST', body: { listingId: ids.otherPet } })).data.conversation.id;
    const p = (await f.post('shelter', 'propose', { id: randomUUID() }, { ...times(), startsAt: first.startsAt, conversationId: other })).data.appointment;
    assert.equal((await f.post('stranger', 'accept', p, { conversationId: other })).statusCode, 409);
  } finally { await f.close(); }
});

test('re-enabling email revives only unsent notifications and late opt-in gets one prompt reminder', async () => {
  const f = await fixture();
  try {
    const row = await f.confirmed(600000);
    await f.post('adopter', 'reminders', row, { emailReminder: true });
    await f.post('adopter', 'reminders', row, { emailReminder: false });
    await runAppointmentMaintenance(f.database, f.emailDeps);
    await f.post('adopter', 'reminders', row, { emailReminder: true });
    await runAppointmentMaintenance(f.database, f.emailDeps);
    assert.equal(f.emails.length, 1);
    assert.equal(f.emails[0].subject, 'Your Pawline appointment is coming up');
    await f.post('adopter', 'reminders', row, { emailReminder: true });
    await runAppointmentMaintenance(f.database, f.emailDeps);
    assert.equal(f.emails.length, 1);
  } finally { await f.close(); }
});

test('email opt-out during account lookup prevents provider submission', async () => {
  const f = await fixture();
  try {
    const row = await f.confirmed();
    await f.post('adopter', 'reminders', row, { emailReminder: true });
    await runAppointmentMaintenance(f.database, { ...f.emailDeps, resolveEmail: async () => {
      await f.post('adopter', 'reminders', row, { emailReminder: false });
      return 'adopter@example.test';
    } });
    assert.equal(f.emails.length, 0);
  } finally { await f.close(); }
});

test('blocking during room creation waits for creation then closes it without issuing access', async () => {
  const f = await fixture();
  let release, started;
  const gate = new Promise(resolve => { release = resolve; }), creating = new Promise(resolve => { started = resolve; });
  let created = false, closedBeforeCreation = false, closes = 0, tokens = 0;
  f.provider.room = async row => { started(); await gate; created = true; return `${environment.DAILY_DOMAIN}/${row.room_name}`; };
  f.provider.close = async () => { closedBeforeCreation ||= !created; closes++; };
  f.provider.token = async () => { tokens++; return 'fixture-token'; };
  try {
    const row = await f.confirmed(0);
    const joining = f.post('adopter', 'join', row);
    await creating;
    await f.invoke('direct-conversations', 'shelter', { method: 'PATCH', body: { conversationId: f.conversationId, action: 'block' } });
    release();
    assert.notEqual((await joining).statusCode, 200);
    assert.equal(closedBeforeCreation, false); assert.equal(closes, 1); assert.equal(tokens, 0);
    const [stored] = await f.database`SELECT state, room_closed FROM adoption_appointments WHERE id = ${row.id}`;
    assert.equal(stored.state, 'cancelled'); assert.equal(stored.room_closed, true);
  } finally { release(); await f.close(); }
});

test('access revoked during token creation is checked before returning the token', async () => {
  const f = await fixture();
  try {
    const row = await f.confirmed(0);
    f.provider.token = async () => {
      await f.invoke('direct-conversations', 'shelter', { method: 'PATCH', body: { conversationId: f.conversationId, action: 'block' } });
      return 'must-not-be-returned';
    };
    const result = await f.post('adopter', 'join', row);
    assert.notEqual(result.statusCode, 200);
    assert.ok(!JSON.stringify(result.data).includes('must-not-be-returned'));
  } finally { await f.close(); }
});

test('a failing room cleanup does not block unrelated reminders', async () => {
  const f = await fixture();
  try {
    const row = await f.confirmed(0);
    await f.post('adopter', 'join', row);
    await f.database`UPDATE adoption_appointments SET state = 'completed' WHERE id = ${row.id}`;
    const next = await f.confirmed();
    await f.post('adopter', 'reminders', next, { emailReminder: true });
    f.provider.close = async () => { throw new Error('Provider timeout'); };
    const result = await runAppointmentMaintenance(f.database, f.emailDeps);
    assert.equal(result.sent, 1); assert.equal(result.closeFailed, 1);
    assert.equal(f.emails.length, 1);
  } finally { await f.close(); }
});

test('simultaneous joins have one room creator and later joins never recreate the room', async () => {
  const f = await fixture();
  let release, started, rooms = 0;
  const gate = new Promise(resolve => { release = resolve; }), creating = new Promise(resolve => { started = resolve; });
  f.provider.room = async row => { rooms++; started(); await gate; return `${environment.DAILY_DOMAIN}/${row.room_name}`; };
  try {
    const row = await f.confirmed(0);
    const joining = f.post('adopter', 'join', row);
    await creating;
    const waiting = await f.post('shelter', 'join', row);
    assert.equal(waiting.statusCode, 409);
    assert.match(waiting.data.error, /being prepared/);
    release();
    assert.equal((await joining).statusCode, 200);
    assert.equal((await f.post('shelter', 'join', row)).statusCode, 200);
    assert.equal((await f.post('adopter', 'join', row)).statusCode, 200);
    assert.equal(rooms, 1);
    assert.equal(f.calls.filter(action => action === 'close').length, 0);
  } finally { release(); await f.close(); }
});

test('finishing remains effective through a provider outage and maintenance retries closure', async () => {
  const f = await fixture();
  try {
    const row = await f.confirmed(0);
    await f.post('adopter', 'join', row);
    f.provider.close = async () => { throw new Error('Provider timeout'); };
    const ended = await f.post('adopter', 'end', row);
    assert.equal(ended.statusCode, 200); assert.equal(ended.data.appointment.state, 'completed');
    assert.equal(ended.data.appointment.videoClosed, false);
    assert.equal((await f.post('shelter', 'join', ended.data.appointment)).statusCode, 403);
    f.provider.close = async () => {};
    assert.equal((await runAppointmentMaintenance(f.database, f.emailDeps)).closed, 1);
    assert.equal((await f.database`SELECT room_closed FROM adoption_appointments WHERE id = ${row.id}`)[0].room_closed, true);
  } finally { await f.close(); }
});

test('maintenance leaves unattempted notifications unclaimed when its time budget is reached', async () => {
  const f = await fixture();
  try {
    const row = await f.confirmed();
    await f.post('adopter', 'reminders', row, { emailReminder: true });
    await f.post('shelter', 'reminders', row, { emailReminder: true });
    let elapsed = 0;
    const result = await runAppointmentMaintenance(f.database, { ...f.emailDeps, clock: () => elapsed,
      sendEmail: async () => { elapsed = 46000; return { id: 'sent' }; } });
    assert.equal(result.sent, 1);
    const due = await f.database`SELECT attempts, lease_until, sent_at FROM appointment_notifications WHERE kind = 'updated' ORDER BY attempts`;
    assert.equal(due.length, 2);
    assert.deepEqual(due.map(message => message.attempts), [0, 1]);
    assert.equal(due[0].lease_until, null); assert.equal(due[0].sent_at, null);
    assert.equal((await runAppointmentMaintenance(f.database, f.emailDeps)).sent, 1);
  } finally { await f.close(); }
});
