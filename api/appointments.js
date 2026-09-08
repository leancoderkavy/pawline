import { directEndpoint, directError, parseConversationId, requireConversation, requireWritable } from './_direct.js';
import { consumeUsage } from './_usage-limit.js';
import { dailyConfigured, dailyProvider } from './_daily.js';

export function normalizeAppointment(input, now = Date.now()) {
  const start = Date.parse(input.startsAt), minutes = Number(input.minutes);
  if (!['video', 'visit'].includes(input.kind) || ![15, 20, 30].includes(minutes)) throw directError('Choose a video hello or final visit lasting 15, 20, or 30 minutes.', 422);
  if (!Number.isFinite(start) || start < now - 30000 || start > now + 60 * 86400000) throw directError('Choose a time between now and 60 days from today.', 422);
  const zone = String(input.timeZone || '');
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); } catch { throw directError('Choose a valid time zone.', 422); }
  const note = typeof input.note === 'string' ? input.note.replace(/[\x00-\x1f\x7f]/g, ' ').trim() : '';
  if (note.length > 600) throw directError('Keep the appointment note under 600 characters.', 422);
  return { start: new Date(start).toISOString(), end: new Date(start + minutes * 60000).toISOString(), zone, kind: input.kind, note };
}

export async function ensureAppointments(db) {
  const [row] = await db`SELECT to_regclass('public.adoption_appointments') AS appointments, to_regclass('public.appointment_notifications') AS notifications, to_regclass('public.appointment_video_reservations') AS reservations`;
  if (!row || Object.values(row).some(value => !value)) throw directError('Appointments are temporarily unavailable.', 503);
}

export async function queueAppointmentEmails(db, appointment) {
  await db`INSERT INTO appointment_notifications (appointment_id, revision, user_id, kind, due_at)
    SELECT ${appointment.id}, ${appointment.revision}, user_id, 'updated', now() FROM appointment_email_preferences
    WHERE appointment_id = ${appointment.id} AND enabled ON CONFLICT DO NOTHING`;
  if (appointment.state === 'confirmed') await db`INSERT INTO appointment_notifications (appointment_id, revision, user_id, kind, due_at)
    SELECT ${appointment.id}, ${appointment.revision}, user_id, 'reminder', ${appointment.starts_at}::timestamptz - interval '30 minutes'
    FROM appointment_email_preferences WHERE appointment_id = ${appointment.id} AND enabled
      AND ${appointment.starts_at}::timestamptz > now() + interval '30 minutes' ON CONFLICT DO NOTHING`;
}

function publicAppointment(row, user, conversation, enabled) {
  const participant = user.id === conversation.inquirer_clerk_user_id || user.id === row.caregiver_id;
  const opposite = (row.proposed_by === conversation.inquirer_clerk_user_id) !== (user.id === conversation.inquirer_clerk_user_id);
  return { id: row.id, kind: row.kind, startsAt: row.starts_at, endsAt: row.ends_at, timeZone: row.time_zone,
    state: row.state, revision: row.revision, note: row.note, nextStep: row.next_step,
    nextStepByMe: row.next_step_by === user.id, emailReminder: Boolean(row.email_reminder),
    videoOpened: Boolean(row.room_name), videoClosed: Boolean(row.room_closed),
    canAccept: row.state === 'proposed' && opposite,
    canEdit: participant || !row.caregiver_id,
    canJoin: enabled && row.kind === 'video' && row.state === 'confirmed' && participant && !row.room_closed
      && !conversation.blocked && conversation.status !== 'resolved' && row.participants_current !== false
      && Date.now() >= new Date(row.starts_at).getTime() - 600000 && Date.now() < new Date(row.ends_at).getTime(),
    canSetNextStep: participant && ['elapsed', 'completed', 'missed'].includes(row.state),
  };
}

export async function reserveVideoMinutes(db, row, environment) {
  // Reserve the full two-person room window, including early joins. Account for
  // both months for sessions straddling UTC month-end; never release on retries.
  const minutes = Math.ceil((new Date(row.ends_at) - new Date(row.starts_at)) / 60000 + 10) * 2;
  const configured = Number(environment.PAWLINE_DAILY_MONTHLY_MINUTES || 9000);
  const limit = Number.isInteger(configured) && configured > 0 ? Math.min(configured, 9000) : 9000;
  const results = await db.transaction([
    db`SELECT pg_advisory_xact_lock(67439123)`,
    db`WITH months AS (
      SELECT generate_series(date_trunc('month', (${row.starts_at}::timestamptz - interval '10 minutes') AT TIME ZONE 'UTC'), date_trunc('month', ${row.ends_at}::timestamptz AT TIME ZONE 'UTC'), interval '1 month')::date AS month
    ) INSERT INTO appointment_video_budget (month) SELECT month FROM months ON CONFLICT DO NOTHING`,
    db`WITH reserved AS (
      INSERT INTO appointment_video_reservations (appointment_id, revision, reserved_minutes)
      SELECT ${row.id}, ${row.revision}, ${minutes} WHERE NOT EXISTS (
        SELECT 1 FROM appointment_video_budget WHERE month BETWEEN date_trunc('month', (${row.starts_at}::timestamptz - interval '10 minutes') AT TIME ZONE 'UTC')::date
          AND date_trunc('month', ${row.ends_at}::timestamptz AT TIME ZONE 'UTC')::date AND reserved_minutes + ${minutes} > ${limit}
      ) ON CONFLICT DO NOTHING RETURNING reserved_minutes
    ) UPDATE appointment_video_budget SET reserved_minutes = appointment_video_budget.reserved_minutes + reserved.reserved_minutes FROM reserved
      WHERE month BETWEEN date_trunc('month', (${row.starts_at}::timestamptz - interval '10 minutes') AT TIME ZONE 'UTC')::date AND date_trunc('month', ${row.ends_at}::timestamptz AT TIME ZONE 'UTC')::date`,
    db`SELECT 1 FROM appointment_video_reservations WHERE appointment_id = ${row.id} AND revision = ${row.revision}`,
  ]);
  if (!results[3].length) throw directError('Video capacity is reached for this month. Please continue in messages.', 429);
}

export function createAppointmentsHandler(dependencies = {}) {
  return directEndpoint(['GET', 'POST'], async ({ request, response, database: db, user, notify, environment }) => {
    await ensureAppointments(db);
    const input = request.method === 'GET' ? request.query : request.body || {};
    const conversation = await requireConversation(db, input.conversationId, user.id);
    const enabled = dailyConfigured(environment);
    const provider = dependencies.provider || dailyProvider(environment);
    await db`UPDATE adoption_appointments a SET state = 'elapsed', revision = revision + 1, updated_at = now()
      WHERE conversation_id = ${conversation.id} AND ends_at < now() AND state IN ('proposed', 'confirmed')`;
    if (request.method === 'GET') {
      const rows = await db`SELECT a.*, COALESCE(p.enabled, false) AS email_reminder FROM adoption_appointments a
        LEFT JOIN appointment_email_preferences p ON p.appointment_id = a.id AND p.user_id = ${user.id}
        WHERE a.conversation_id = ${conversation.id} ORDER BY a.created_at DESC LIMIT 30`;
      for (const row of rows.filter(row => row.state === 'confirmed' && row.caregiver_id)) {
        try { await requireConversation(db, conversation.id, row.caregiver_id); }
        catch (error) { if (error.statusCode !== 404) throw error; row.participants_current = false; }
      }
      return response.status(200).json({ videoEnabled: enabled, appointments: rows.map(row => publicAppointment(row, user, conversation, enabled)) });
    }
    requireWritable(conversation);
    const id = parseConversationId(input.id);
    if (!id) throw directError('A valid appointment ID is required.', 422);
    const action = input.action;
    if (action === 'propose') {
      const clean = normalizeAppointment(input);
      if (clean.kind === 'video' && !enabled) throw directError('Video appointments are not available yet. You can arrange a visit or continue in messages.', 503);
      if (!await consumeUsage(db, { scope: 'appointment_proposal', subject: user.id, limit: 20, windowMs: 3600000 })) throw directError('Too many appointment requests. Please try later.', 429);
      let [row] = await db`INSERT INTO adoption_appointments (id, conversation_id, created_by, proposed_by, caregiver_id, kind, starts_at, ends_at, time_zone, note)
        VALUES (${id}, ${conversation.id}, ${user.id}, ${user.id}, ${user.id === conversation.inquirer_clerk_user_id ? null : user.id}, ${clean.kind}, ${clean.start}, ${clean.end}, ${clean.zone}, ${clean.note}) ON CONFLICT DO NOTHING RETURNING *`;
      if (!row) [row] = await db`SELECT * FROM adoption_appointments WHERE id = ${id} AND conversation_id = ${conversation.id} AND created_by = ${user.id}`;
      if (!row) throw directError('There is already an upcoming appointment in this conversation. Update it instead.', 409);
      await db`INSERT INTO appointment_email_preferences (appointment_id, user_id, enabled) VALUES (${id}, ${user.id}, ${input.emailReminder === true && Boolean(user.email)}) ON CONFLICT DO NOTHING`;
      await queueAppointmentEmails(db, row); await notify(conversation);
      return response.status(201).json({ appointment: publicAppointment(row, user, conversation, enabled) });
    }
    let [row] = await db`SELECT * FROM adoption_appointments WHERE id = ${id} AND conversation_id = ${conversation.id}`;
    if (!row) throw directError('Appointment not found.', 404);
    if (!Number.isInteger(input.revision) || input.revision !== row.revision) throw directError('This appointment changed. Refresh before continuing.', 409);
    const view = publicAppointment(row, user, conversation, enabled);
    if (action === 'join') {
      if (!view.canJoin) throw directError('Only the two confirmed participants can join, from ten minutes before the appointment until it ends.', 403);
      await requireConversation(db, conversation.id, row.caregiver_id);
      if (!await consumeUsage(db, { scope: 'appointment_join', subject: `${id}:${user.id}`, limit: 30, windowMs: 3600000 })) throw directError('Too many connection attempts.', 429);
      await reserveVideoMinutes(db, row, environment);
      const name = `pawline-${id}-r${row.revision}`;
      await db`UPDATE adoption_appointments SET room_name = ${name} WHERE id = ${id} AND revision = ${row.revision} AND state = 'confirmed'`;
      row.room_name = name;
      const url = await provider.room(row);
      const latestConversation = await requireConversation(db, conversation.id, user.id); requireWritable(latestConversation);
      await requireConversation(db, conversation.id, row.caregiver_id);
      const [latest] = await db`SELECT * FROM adoption_appointments WHERE id = ${id}`;
      if (latest.revision !== row.revision || latest.state !== 'confirmed') { await provider.close(name); throw directError('The appointment changed. Please refresh.', 409); }
      await db`UPDATE adoption_appointments SET room_ready = true WHERE id = ${id} AND revision = ${row.revision}`;
      return response.status(200).json({ url, token: await provider.token(row, user), expiresAt: row.ends_at });
    }
    if (action === 'reminders') {
      if (!view.canEdit) throw directError('Only appointment participants can change reminders.', 403);
      if (input.emailReminder && !user.email) throw directError('Verify your account email to receive reminders.', 422);
      await db`INSERT INTO appointment_email_preferences (appointment_id, user_id, enabled) VALUES (${id}, ${user.id}, ${input.emailReminder === true}) ON CONFLICT (appointment_id, user_id) DO UPDATE SET enabled = EXCLUDED.enabled`;
      await queueAppointmentEmails(db, row);
      return response.status(200).json({ ok: true });
    }
    if (action === 'accept') {
      if (!view.canAccept || new Date(row.ends_at) <= new Date()) throw directError('The other side must confirm this proposed time.', 409);
      const caregiver = user.id === conversation.inquirer_clerk_user_id ? row.caregiver_id : user.id;
      if (!caregiver) throw directError('A caregiver must confirm this appointment.', 409);
      await requireConversation(db, conversation.id, caregiver);
      const results = await db.transaction([
        db`SELECT pg_advisory_xact_lock(67439124)`,
        db`UPDATE adoption_appointments a SET state = 'confirmed', caregiver_id = ${caregiver}, revision = revision + 1, updated_at = now()
          WHERE id = ${id} AND revision = ${row.revision} AND state = 'proposed' AND NOT EXISTS (
            SELECT 1 FROM adoption_appointments other JOIN direct_conversations c ON c.id = other.conversation_id
            WHERE other.id <> ${id} AND other.state = 'confirmed' AND other.starts_at < a.ends_at AND other.ends_at > a.starts_at
              AND (other.caregiver_id = ${caregiver} OR c.inquirer_clerk_user_id = ${conversation.inquirer_clerk_user_id})
          ) RETURNING *`,
      ]);
      [row] = results[1];
      if (!row) throw directError('One participant already has an appointment at that time, or this proposal changed.', 409);
      await db`INSERT INTO appointment_email_preferences (appointment_id, user_id, enabled) VALUES (${id}, ${user.id}, ${input.emailReminder === true && Boolean(user.email)}) ON CONFLICT (appointment_id, user_id) DO UPDATE SET enabled = EXCLUDED.enabled`;
    } else if (action === 'reschedule' || action === 'cancel') {
      if (!view.canEdit || !['proposed', 'confirmed'].includes(row.state)) throw directError('Only the participants can change an upcoming appointment.', 403);
      if (row.room_name) throw directError('This video room has already opened. End the appointment before arranging another.', 409);
      const clean = action === 'reschedule' ? normalizeAppointment({ ...input, kind: row.kind }) : null;
      const caregiver = clean && user.id !== conversation.inquirer_clerk_user_id ? user.id : row.caregiver_id;
      const [updated] = await db`UPDATE adoption_appointments SET state = ${clean ? 'proposed' : 'cancelled'}, proposed_by = ${user.id},
        caregiver_id = ${caregiver},
        starts_at = ${clean?.start || row.starts_at}, ends_at = ${clean?.end || row.ends_at}, time_zone = ${clean?.zone || row.time_zone}, note = ${clean?.note ?? row.note},
        revision = revision + 1, updated_at = now() WHERE id = ${id} AND revision = ${row.revision} AND room_name IS NULL RETURNING *`;
      if (!updated) throw directError('Appointment changed. Refresh before continuing.', 409); row = updated;
    } else if (action === 'end') {
      if (!view.canEdit || !['confirmed', 'elapsed'].includes(row.state) || new Date(row.starts_at) > new Date() && !row.room_name) throw directError('Participants can finish an appointment after its start time or after opening its video room.', 403);
      if (row.room_name) await provider.close(row.room_name);
      const [updated] = await db`UPDATE adoption_appointments SET state = 'completed', room_closed = true, revision = revision + 1, updated_at = now()
        WHERE id = ${id} AND revision = ${row.revision} RETURNING *`;
      if (!updated) throw directError('Appointment changed. Please refresh.', 409); row = updated;
    } else if (action === 'next_step') {
      if (!view.canSetNextStep || !['continue_application', 'request_information', 'schedule_visit', 'withdraw_interest'].includes(input.nextStep)) throw directError('Choose an adoption next step.', 422);
      const [updated] = await db`UPDATE adoption_appointments SET next_step = ${input.nextStep}, next_step_by = ${user.id}, revision = revision + 1, updated_at = now()
        WHERE id = ${id} AND revision = ${row.revision} RETURNING *`;
      if (!updated) throw directError('Appointment changed. Please refresh.', 409); row = updated;
    } else throw directError('Choose a valid appointment action.', 422);
    await queueAppointmentEmails(db, row); await notify(conversation);
    return response.status(200).json({ appointment: publicAppointment(row, user, conversation, enabled) });
  }, dependencies);
}
export default createAppointmentsHandler();
