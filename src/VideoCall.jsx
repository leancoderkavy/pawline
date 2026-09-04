"use client";
import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, X } from "lucide-react";
import { VideoSession } from "./videoSession.js";

const labels = { preview: "Check your camera and microphone", ringing: "Waiting for an answer…", connecting: "Connecting…", connected: "Connected", reconnecting: "Reconnecting…", ended: "Call ended", cancelled: "Call cancelled", missed: "No answer this time", declined: "Call declined", answered: "Another team member answered", error: "Call interrupted" };
const finished = new Set(["ended", "cancelled", "missed", "declined", "answered", "error"]);

function StreamVideo({ stream, local }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    if (element) { element.srcObject = stream || null; element.play().catch(() => {}); }
    return () => { if (element) element.srcObject = null; };
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={local} aria-label={local ? "Your camera preview" : "Other participant video"} />;
}

export default function VideoCall({ request, conversation, invitation, onClose }) {
  const dialog = useRef(null);
  const session = useRef(null);
  const [state, setState] = useState({ phase: "setup", error: "", localStream: null, remoteStream: null });
  const [busy, setBusy] = useState(false);
  const [audio, setAudio] = useState(true);
  const [video, setVideo] = useState(true);
  useEffect(() => {
    const controller = new VideoSession({ request, conversationId: conversation.id, call: invitation, onChange: value => setState(current => ({ ...current, ...value })) });
    session.current = controller;
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element.showModal();
    if (invitation) controller.monitor();
    const leave = () => controller.dispose();
    window.addEventListener("pagehide", leave);
    return () => { window.removeEventListener("pagehide", leave); controller.dispose(); element.close(); previousFocus?.focus?.(); };
  }, [request, conversation.id, invitation]);
  const run = async action => {
    setBusy(true);
    setState(current => ({ ...current, error: "" }));
    try { await action(); } catch (error) { setState(current => ({ ...current, error: error.message })); }
    finally { setBusy(false); }
  };
  const done = finished.has(state.phase);
  const live = ["ringing", "connecting", "connected", "reconnecting"].includes(state.phase);
  return <dialog className="video-dialog" ref={dialog} aria-labelledby="video-title" onCancel={onClose}>
    <header><div><p className="chat-eyebrow">Private video call</p><h2 id="video-title">Meet {conversation.listing.name}</h2><p>{conversation.other.name}</p></div><button type="button" className="chat-icon" aria-label="Close video call" onClick={onClose}><X /></button></header>
    <div className="video-stage">
      {state.remoteStream ? <StreamVideo stream={state.remoteStream} /> : <div className="video-placeholder"><Video /><strong>{labels[state.phase] || (invitation ? `${invitation.callerName} invited you to a call` : "Say hello, face to face")}</strong><p>{state.phase === "setup" ? "Preview your devices before joining. Pawline does not record calls." : state.phase === "ringing" ? "They can join from their Messages inbox." : "You can always continue the conversation in messages."}</p></div>}
      {state.localStream ? <div className={`video-self ${video ? "" : "camera-off"}`}><StreamVideo stream={state.localStream} local /><span>You{!video ? " · Camera off" : ""}</span></div> : null}
    </div>
    <p className="video-state" role="status">{labels[state.phase] || "Your devices stay off until you preview them."}</p>
    {state.error ? <p className="chat-error" role="alert">{state.error}</p> : null}
    {!done ? <div className="video-controls">
      {state.localStream ? <button type="button" aria-label={audio ? "Mute microphone" : "Unmute microphone"} aria-pressed={!audio} onClick={() => { session.current.toggle("audio", !audio); setAudio(!audio); }}>{audio ? <Mic /> : <MicOff />}</button> : null}
      <button type="button" aria-label={video ? "Turn camera off" : "Turn camera on"} aria-pressed={!video} disabled={Boolean(state.localStream && !state.localStream.getVideoTracks().length)} onClick={() => { session.current.toggle("video", !video); setVideo(!video); }}>{video ? <Video /> : <VideoOff />}</button>
      {!state.localStream ? <button type="button" className="button" disabled={busy} onClick={() => run(() => session.current.preview(video))}>{busy ? "Opening devices…" : "Preview devices"}</button> : !live ? <button type="button" className="button" disabled={busy} onClick={() => run(() => session.current.join())}>{busy ? "Joining…" : invitation ? "Accept and join" : "Start call"}</button> : <button type="button" className="video-hangup" aria-label="End call" onClick={onClose}><PhoneOff />End call</button>}
      {invitation && !live ? <button type="button" disabled={busy} onClick={() => run(() => session.current.decline())}>Decline</button> : null}
    </div> : <button type="button" className="button" onClick={onClose}>Back to messages</button>}
    <p className="video-note">Only you and one person from the conversation can join. Keep personal details and payments out of the call.</p>
  </dialog>;
}
