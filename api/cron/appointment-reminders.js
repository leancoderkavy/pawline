import { createClerkClient } from '@clerk/backend';
import { getDatabase } from '../_db.js';
import { requireConversation, requireWritable } from '../_direct.js';
import { ensureAppointments } from '../appointments.js';
import { dailyProvider, dailyConfigured } from '../_daily.js';
import { sendShelterConfirmationEmail } from '../_email.js';

export async function runAppointmentMaintenance(db, deps = {}) {
  const env = deps.environment || process.env, provider = deps.provider || dailyProvider(env);
  const resolveEmail = deps.resolveEmail || (async id => {
    const user = await createClerkClient({ secretKey: env.CLERK_SECRET_KEY }).users.getUser(id);
    return user.emailAddresses.find(email => email.id === user.primaryEmailAddressId && email.verification?.status === 'verified')?.emailAddress;
  });
  let sent = 0, discarded = 0, closed = 0, failed = 0;
  if (env.DAILY_API_KEY) {
    const rooms = await db`SELECT * FROM adoption_appointments WHERE room_name IS NOT NULL AND NOT room_closed ORDER BY updated_at LIMIT 100`;
    for (const room of rooms) {
      let mustClose = !dailyConfigured(env) || room.state !== 'confirmed' || new Date(room.ends_at) < new Date();
      if (!mustClose) {
        try { const c = await requireConversation(db, room.conversation_id, room.caregiver_id); requireWritable(c); }
        catch (error) { if ([403, 404, 409].includes(error.statusCode)) mustClose = true; else throw error; }
      }
      if (mustClose) { await provider.close(room.room_name); await db`UPDATE adoption_appointments SET room_closed = true WHERE id = ${room.id}`; closed++; }
    }
  }
  const queued = await db`WITH ready AS (
    SELECT id FROM appointment_notifications WHERE sent_at IS NULL AND NOT discarded AND due_at <= now() AND attempts < 5
      AND (lease_until IS NULL OR lease_until < now()) ORDER BY due_at LIMIT 30 FOR UPDATE SKIP LOCKED
  ) UPDATE appointment_notifications n SET lease_until = now() + interval '5 minutes', attempts = attempts + 1 FROM ready WHERE n.id = ready.id RETURNING n.*`;
  for (const message of queued) {
    try {
      const [a] = await db`SELECT a.*, p.enabled FROM adoption_appointments a LEFT JOIN appointment_email_preferences p ON p.appointment_id = a.id AND p.user_id = ${message.user_id} WHERE a.id = ${message.appointment_id}`;
      let allowed = a && a.enabled && a.revision === message.revision;
      if (message.kind === 'reminder') allowed = allowed && a.state === 'confirmed' && new Date(a.starts_at) > new Date();
      if (allowed) {
        try {
          const c = await requireConversation(db, a.conversation_id, message.user_id); requireWritable(c);
          allowed = message.user_id === c.inquirer_clerk_user_id || message.user_id === a.caregiver_id;
        } catch (error) { if ([403, 404, 409].includes(error.statusCode)) allowed = false; else throw error; }
      }
      if (!allowed) { await db`UPDATE appointment_notifications SET discarded = true WHERE id = ${message.id}`; discarded++; continue; }
      const to = await resolveEmail(message.user_id);
      if (!to) { await db`UPDATE appointment_notifications SET discarded = true WHERE id = ${message.id}`; discarded++; continue; }
      const time = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: a.time_zone }).format(new Date(a.starts_at));
      await (deps.sendEmail || sendShelterConfirmationEmail)({ to, subject: message.kind === 'reminder' ? 'Your Pawline appointment is coming up' : 'Your Pawline appointment was updated',
        text: `Your ${a.kind === 'video' ? 'video hello' : 'final visit'} is ${a.state}.\n\n${time} (${a.time_zone})\n\nOpen Pawline Messages for the latest details:\nhttps://www.pawlineadopt.com/#messages\n\nYou can turn off appointment emails in that conversation.`, idempotencyKey: `appointment-${message.id}` });
      await db`UPDATE appointment_notifications SET sent_at = now(), lease_until = NULL WHERE id = ${message.id}`; sent++;
    } catch { failed++; /* Lease expires for a bounded, provider-idempotent retry. */ }
  }
  await db`DELETE FROM appointment_webhook_events WHERE received_at < now() - interval '30 days'`;
  const [backlog] = await db`SELECT count(*)::int AS exhausted FROM appointment_notifications WHERE sent_at IS NULL AND NOT discarded AND attempts >= 5`;
  return { sent, discarded, closed, failed, exhausted: backlog.exhausted };
}
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  if (!process.env.CRON_SECRET || request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return response.status(401).json({ error: 'Unauthorized' });
  try { const db = getDatabase(); await ensureAppointments(db); return response.status(200).json({ ok: true, ...await runAppointmentMaintenance(db) }); }
  catch { return response.status(503).json({ error: 'Appointment maintenance unavailable' }); }
}
