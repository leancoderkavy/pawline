"use client";
import { useEffect, useRef, useState } from 'react';

export default function DailyAppointmentCall({ request, conversation, appointment, onLeave, onFinish }) {
  const container = useRef(null), callbacks = useRef({ onLeave, onFinish });
  callbacks.current = { onLeave, onFinish };
  const [status, setStatus] = useState('Opening your private video hello…');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let disposed = false, frame, timer, expiry;
    const destroy = async () => { if (frame) { const old = frame; frame = null; await old.destroy().catch(() => {}); } };
    const recheck = async () => {
      try {
        const result = await request(`/api/appointments?conversationId=${conversation.id}`);
        const row = result.appointments.find(item => item.id === appointment.id);
        if (!row?.canJoin || row.revision !== appointment.revision) throw new Error('This appointment is no longer open. Return to your conversation for the next step.');
      } catch (failure) { if (!disposed) { setError(failure.message); await destroy(); } return; }
      if (!disposed) timer = setTimeout(recheck, 10000);
    };
    (async () => {
      const { default: Daily } = await import('@daily-co/daily-js');
      if (disposed) return;
      const access = await request('/api/appointments', { method: 'POST', body: JSON.stringify({ action: 'join', conversationId: conversation.id, id: appointment.id, revision: appointment.revision }) });
      if (disposed) return;
      frame = Daily.createFrame(container.current, { showLeaveButton: true, iframeStyle: { width: '100%', height: '100%', border: '0' } });
      frame.iframe().title = `Private video hello about ${conversation.listing.name}`;
      frame.on('joined-meeting', () => { if (!disposed) setStatus('You’re in the call. You can keep your camera off.'); });
      frame.on('left-meeting', () => { if (!disposed) callbacks.current.onLeave(); });
      frame.on('error', () => { if (!disposed) { setError('The call could not connect. Return to messages and try joining again.'); destroy(); } });
      expiry = setTimeout(() => { if (!disposed) { setError('Your appointment time has ended.'); destroy(); } }, Math.max(0, new Date(access.expiresAt) - new Date()));
      timer = setTimeout(recheck, 10000);
      await frame.join({ url: access.url, token: access.token });
    })().catch(failure => { if (!disposed) { setError(failure.status ? failure.message : 'Video is temporarily unavailable. Go back to your appointment to try again or arrange another time.'); destroy(); } });
    return () => { disposed = true; clearTimeout(timer); clearTimeout(expiry); destroy(); };
  }, [request, conversation.id, conversation.listing.name, appointment.id, appointment.revision]);
  const finish = async () => { setBusy(true); try { await callbacks.current.onFinish(); } catch (failure) { setError(failure.message); } finally { setBusy(false); } };
  return <div className="appointment-call">
    <p role={error ? 'alert' : 'status'}>{error || status}</p>
    {!error ? <div ref={container} className="appointment-video-frame" /> : null}
    <p className="appointment-hint">Pawline does not record or transcribe this call. Daily carries the live audio and video. Use headphones for clearer sound.</p>
    <div className="appointment-actions"><button type="button" onClick={onLeave}>Back to appointment</button><button type="button" className="button" onClick={finish} disabled={busy}>{busy ? 'Finishing…' : 'Finish appointment for both people'}</button></div>
  </div>;
}
