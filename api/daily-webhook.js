import { createHmac, timingSafeEqual } from 'node:crypto';
import { getDatabase } from './_db.js';
import { participantId } from './_daily.js';

export function verifyDailyWebhook(body, headers, secret, now = Date.now()) {
  const timestamp = String(headers['x-webhook-timestamp'] || ''), signature = String(headers['x-webhook-signature'] || '');
  if (!secret || !/^\d+(\.\d+)?$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', Buffer.from(secret, 'base64')).update(`${timestamp}.${JSON.stringify(body)}`).digest();
  const actual = Buffer.from(signature, 'base64');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createDailyWebhookHandler(deps = {}) {
  return async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
    const event = request.body, env = deps.environment || process.env;
    // Daily's unsigned setup probe contains no event and performs no database work.
    if (event?.test === 'test' && Object.keys(event).length === 1) return response.status(200).json({ ok: true });
    if (!verifyDailyWebhook(event, request.headers, env.DAILY_WEBHOOK_SECRET)) return response.status(401).json({ error: 'Invalid webhook signature' });
    if (typeof event?.id !== 'string' || event.id.length > 200 || !['participant.joined', 'participant.left', 'meeting.ended'].includes(event.type)) return response.status(200).json({ ignored: true });
    const room = event.payload?.room;
    if (typeof room !== 'string' || !/^pawline-[0-9a-f-]{36}-r\d+$/.test(room)) return response.status(200).json({ ignored: true });
    try {
      const db = (deps.getDatabase || getDatabase)();
      const [row] = await db`SELECT a.*, c.inquirer_clerk_user_id FROM adoption_appointments a JOIN direct_conversations c ON c.id = a.conversation_id WHERE a.room_name = ${room}`;
      if (!row) return response.status(200).json({ ignored: true });
      const revision = Number(room.split('-r').at(-1));
      const identity = event.payload?.user_id;
      if (event.type !== 'meeting.ended' && ![participantId(row.inquirer_clerk_user_id), participantId(row.caregiver_id || '')].includes(identity)) return response.status(200).json({ ignored: true });
      const eventTime = event.type === 'participant.joined' ? event.payload.joined_at : event.type === 'participant.left' ? Number(event.payload.joined_at) + Number(event.payload.duration) : event.payload.end_ts;
      const seconds = Number(eventTime ?? event.event_ts);
      if (!Number.isFinite(seconds) || seconds < 0 || seconds * 1000 > Date.now() + 60000) return response.status(400).json({ error: 'Invalid event time' });
      const when = new Date(seconds * 1000).toISOString();
      const changes = event.type === 'meeting.ended'
        ? db`WITH receipt AS (INSERT INTO appointment_webhook_events (id) VALUES (${event.id}) ON CONFLICT DO NOTHING RETURNING id)
          UPDATE adoption_appointments SET last_call_ended_at = GREATEST(last_call_ended_at, ${when}::timestamptz) WHERE id = ${row.id} AND EXISTS (SELECT 1 FROM receipt)`
        : event.type === 'participant.joined'
          ? db`WITH receipt AS (INSERT INTO appointment_webhook_events (id) VALUES (${event.id}) ON CONFLICT DO NOTHING RETURNING id)
            INSERT INTO appointment_attendance (appointment_id, revision, participant_id, first_joined_at)
            SELECT ${row.id}, ${revision}, ${identity}, ${when} WHERE EXISTS (SELECT 1 FROM receipt)
            ON CONFLICT (appointment_id, revision, participant_id) DO UPDATE SET first_joined_at = LEAST(appointment_attendance.first_joined_at, EXCLUDED.first_joined_at)`
          : db`WITH receipt AS (INSERT INTO appointment_webhook_events (id) VALUES (${event.id}) ON CONFLICT DO NOTHING RETURNING id)
            INSERT INTO appointment_attendance (appointment_id, revision, participant_id, first_joined_at, last_left_at)
            SELECT ${row.id}, ${revision}, ${identity}, ${new Date(Number(event.payload.joined_at ?? seconds) * 1000).toISOString()}, ${when} WHERE EXISTS (SELECT 1 FROM receipt)
            ON CONFLICT (appointment_id, revision, participant_id) DO UPDATE SET last_left_at = GREATEST(appointment_attendance.last_left_at, EXCLUDED.last_left_at)`;
      await changes;
      return response.status(200).json({ ok: true });
    } catch { return response.status(503).json({ error: 'Webhook processing unavailable' }); }
  };
}
export default createDailyWebhookHandler();
