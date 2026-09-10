"use client";
import { useState } from 'react';

const localValue = date => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
export default function AppointmentForm({ current, videoEnabled, busy, onSubmit, onCancel, initialKind }) {
  const [kind, setKind] = useState(current?.kind || initialKind || (videoEnabled ? 'video' : 'visit'));
  const [when, setWhen] = useState(localValue(current ? new Date(current.startsAt) : new Date(Date.now() + 3600000)));
  const [minutes, setMinutes] = useState(current ? (new Date(current.endsAt) - new Date(current.startsAt)) / 60000 : 20);
  const [note, setNote] = useState(current?.note || '');
  const [emailReminder, setEmailReminder] = useState(false);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const submit = (event, now = false) => {
    event.preventDefault();
    const startsAt = now ? new Date().toISOString() : new Date(when).toISOString();
    onSubmit({ kind, startsAt, minutes: Number(minutes), timeZone: zone, note, emailReminder });
  };
  return <form className="appointment-form" onSubmit={submit}>
    <h3>{current ? 'Suggest a different time' : 'Make time to meet'}</h3>
    <p>The other person confirms the time before your appointment is booked.</p>
    {!current ? <label>How would you like to meet?<select value={kind} onChange={event => setKind(event.target.value)}><option value="video" disabled={!videoEnabled}>Video hello{!videoEnabled ? ' · unavailable' : ''}</option><option value="visit">In-person visit</option></select></label> : null}
    <label>Your local date and time<input type="datetime-local" step="1" required value={when} onChange={event => setWhen(event.target.value)} /></label>
    <p className="appointment-hint">Times are shown in {zone.replaceAll('_', ' ')}.</p>
    <label>Length<select value={minutes} onChange={event => setMinutes(event.target.value)}>{[15, 20, 30].map(value => <option key={value} value={value}>{value} minutes</option>)}</select></label>
    <label>{kind === 'visit' ? 'Visit arrangements' : 'What would you like to talk about?'}<textarea rows={3} maxLength={600} value={note} onChange={event => setNote(event.target.value)} placeholder={kind === 'visit' ? 'Agree on a safe meeting place in your private conversation.' : 'Daily routines, other pets, or a question about the adoption process…'} /></label>
    {!current ? <label className="appointment-checkbox"><input type="checkbox" checked={emailReminder} onChange={event => setEmailReminder(event.target.checked)} />Email me appointment updates and a reminder</label> : null}
    <div className="appointment-actions"><button type="submit" className="button" disabled={busy}>{busy ? 'Saving…' : 'Propose time'}</button>{!current && kind === 'video' ? <button type="button" disabled={busy} onClick={event => submit(event, true)}>Suggest a video hello now</button> : null}<button type="button" onClick={onCancel} disabled={busy}>Back</button></div>
  </form>;
}
