"use client";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, Video } from 'lucide-react';
import Dialog from './Dialog.jsx';
import AppointmentForm from './AppointmentForm.jsx';
import { downloadAppointment } from './appointmentCalendar.js';
import './appointments.css';

const DailyCall = lazy(() => import('./DailyAppointmentCall.jsx'));
const labels = { proposed: 'Waiting for confirmation', confirmed: 'Confirmed', cancelled: 'Cancelled', elapsed: 'Time ended', completed: 'Finished', missed: 'Missed' };
const steps = { continue_application: 'Continue application', request_information: 'Ask for more information', schedule_visit: 'Arrange a final visit', withdraw_interest: 'No longer interested' };
const formatTime = value => new Date(value).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

export default function AppointmentPanel({ request, conversation, onClose }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null), [call, setCall] = useState(null);
  const [emailOptIn, setEmailOptIn] = useState(false);
  const alive = useRef(true), serial = useRef(0), pendingId = useRef(null);
  const paused = conversation.blocked || conversation.status === 'resolved';
  const refresh = useCallback(async () => {
    const current = ++serial.current;
    const result = await request(`/api/appointments?conversationId=${conversation.id}`);
    if (alive.current && current === serial.current) { setData(result); return result; }
  }, [request, conversation.id]);
  useEffect(() => {
    alive.current = true;
    let stopped = false, timer;
    const poll = async () => {
      try { await refresh(); } catch (failure) { if (!stopped) setError(failure.message); }
      if (!stopped) timer = setTimeout(poll, 5000);
    };
    poll();
    return () => { stopped = true; alive.current = false; serial.current++; clearTimeout(timer); };
  }, [refresh]);
  const action = async (type, row, extra = {}) => {
    setBusy(true); setError('');
    try {
      const result = await request('/api/appointments', { method: 'POST', body: JSON.stringify({ action: type, conversationId: conversation.id, id: row.id, revision: row.revision, ...extra }) });
      await refresh();
      return result;
    } catch (failure) { if (alive.current) setError(failure.message); await refresh().catch(() => {}); return null; }
    finally { if (alive.current) setBusy(false); }
  };
  const propose = async values => {
    pendingId.current ||= crypto.randomUUID();
    const result = await action(form.current ? 'reschedule' : 'propose', form.current || { id: pendingId.current }, values);
    if (result && alive.current) { pendingId.current = null; setForm(null); }
  };
  const finish = async row => { const result = await action('end', row); if (result && alive.current) setCall(null); };
  const setNextStep = async (row, nextStep) => {
    const result = await action('next_step', row, { nextStep });
    if (!result || !alive.current) return;
    if (nextStep === 'continue_application') { onClose(); window.location.hash = 'applications'; }
    if (nextStep === 'schedule_visit') setForm({ initialKind: 'visit' });
  };
  const upcoming = data?.appointments.find(row => ['proposed', 'confirmed'].includes(row.state));
  return <Dialog title={`${call ? 'Video hello' : 'Meet'} · ${conversation.listing.name}`} onClose={onClose}>
    <div className={`appointment-panel${call ? ' has-call' : ''}`}>
      <p className="appointment-context">{conversation.other.name} · About {conversation.listing.name}</p>
      {error ? <div role="alert" className="appointment-error"><p>{error}</p><button type="button" onClick={() => { setError(''); refresh().catch(failure => setError(failure.message)); }}>Refresh appointments</button></div> : null}
      {call ? <Suspense fallback={<p role="status">Opening video hello…</p>}><DailyCall request={request} conversation={conversation} appointment={call} onLeave={() => { setCall(null); refresh().catch(() => {}); }} onFinish={() => finish(call)} /></Suspense> : <>
        {!data ? <p role="status">Loading appointments…</p> : paused ? <p role="status">Reopen or unblock this conversation to arrange a meeting.</p> : form ? <AppointmentForm key={form.current?.id || 'new'} current={form.current} initialKind={form.initialKind} videoEnabled={data.videoEnabled} busy={busy} onSubmit={propose} onCancel={() => setForm(null)} /> : <>
          {!upcoming ? <div className="appointment-intro"><CalendarDays /><h3>Get to know them before you visit.</h3><p>Arrange a video hello with the caregiver, ask your questions, and plan a final visit when you’re ready.</p><button type="button" className="button" onClick={() => { pendingId.current = null; setForm({}); }}>Propose an appointment</button>{!data.videoEnabled ? <p className="appointment-hint">Video hellos are coming soon. You can arrange a final visit now.</p> : null}</div> : null}
          {data.appointments.map(row => <article key={row.id} className="appointment-card" aria-label={`${row.kind === 'video' ? 'Video hello' : 'Final visit'} appointment`}>
            <div className="appointment-card-heading">{row.kind === 'video' ? <Video /> : <CalendarDays />}<h3>{row.kind === 'video' ? 'Video hello' : 'Final visit'}</h3><span className="appointment-state">{labels[row.state]}</span></div>
            <p className="appointment-time"><time dateTime={row.startsAt}>{formatTime(row.startsAt)}</time></p>
            <p className="appointment-hint">{Math.round((new Date(row.endsAt) - new Date(row.startsAt)) / 60000)} minutes · {row.kind === 'video' ? 'Join here in Pawline' : 'Confirm the meeting place in messages'}</p>
            {row.note ? <p className="appointment-note">{row.note}</p> : null}
            {row.canAccept ? <><label className="appointment-checkbox"><input type="checkbox" checked={emailOptIn} onChange={event => setEmailOptIn(event.target.checked)} />Email me updates and a reminder</label><button type="button" className="button" disabled={busy} onClick={() => action('accept', row, { emailReminder: emailOptIn })}>Confirm this time</button></> : row.state === 'proposed' ? <p className="appointment-hint">The other person needs to confirm this time.</p> : null}
            {row.state === 'confirmed' ? <><div className="appointment-actions">{row.canJoin ? <button type="button" className="button" onClick={() => { setError(''); setCall(row); }}><Video />Join video hello</button> : row.kind === 'video' ? <p className="appointment-hint">{row.videoClosed ? 'This video appointment has closed. Mark it finished to arrange another.' : 'The two confirmed participants can join from ten minutes before the start, until the appointment ends.'}</p> : null}<button type="button" onClick={() => downloadAppointment(row, conversation.listing.name)}>Add to calendar</button></div><p className="appointment-hint">Calendar downloads do not update automatically after rescheduling.</p></> : null}
            {row.canEdit ? <><label className="appointment-checkbox"><input type="checkbox" checked={row.emailReminder} disabled={busy} onChange={event => action('reminders', row, { emailReminder: event.target.checked })} />Email me appointment updates and reminders</label><div className="appointment-actions">{['proposed', 'confirmed'].includes(row.state) ? <><button type="button" disabled={busy} onClick={() => setForm({ current: row })}>Suggest another time</button><button type="button" disabled={busy} onClick={() => action('cancel', row)}>Cancel appointment</button></> : null}{['confirmed', 'elapsed'].includes(row.state) && (new Date(row.startsAt) <= new Date() || row.videoOpened) ? <button type="button" disabled={busy} onClick={() => finish(row)}>Mark appointment finished</button> : null}</div></> : null}
            {row.canSetNextStep ? <div className="appointment-next"><h4>What happens next?</h4><p>Share your next step with the other person.</p><div className="appointment-actions">{Object.entries(steps).map(([value, label]) => <button type="button" key={value} disabled={busy || value === 'schedule_visit' && Boolean(upcoming)} onClick={() => setNextStep(row, value)}>{label}</button>)}</div><p className="appointment-hint">This shares your intention. Application decisions and withdrawals are managed in Applications.</p></div> : null}
            {row.nextStep ? <p className="appointment-next-status" role="status">{row.nextStepByMe ? 'You chose' : 'Their next step'}: {steps[row.nextStep]}</p> : null}
          </article>)}
        </>}
      </>}
    </div>
  </Dialog>;
}
