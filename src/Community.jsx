import React, { useEffect, useRef, useState } from "react";
import Ably from "ably";
import { SignInButton, UserButton, useAuth, useUser } from "@clerk/react";
import {
  AlertTriangle, CheckCircle2, ExternalLink, Flag, Globe2, Link2,
  LoaderCircle, LockKeyhole, MapPin, MessageCircle, Send, ShieldCheck, Users,
} from "lucide-react";

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;

async function json(response, fallback) {
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error(fallback);
  return response.json();
}

function LeadCard({ lead }) {
  if (!lead) return null;
  return <article className="community-lead-card">
    {lead.imageUrl ? <img src={lead.imageUrl} alt="" /> : <span className="lead-fallback"><Globe2 /></span>}
    <span>
      <small>{lead.sourceDomain || "Outside listing"}</small>
      <strong>{lead.name || "Pet listing"}</strong>
      {lead.city ? <em><MapPin />{lead.city}{lead.country ? `, ${lead.country}` : ""}</em> : null}
      <b>Needs confirmation</b>
    </span>
    {lead.sourceUrl ? <a href={lead.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open ${lead.name || "listing"}`}><ExternalLink /></a> : null}
  </article>;
}

function Message({ message, currentUserId, onReport }) {
  const mine = message.author?.id === currentUserId;
  return <article className={`community-message ${mine ? "is-mine" : ""}`}>
    {message.author?.imageUrl ? <img className="message-avatar" src={message.author.imageUrl} alt="" /> :
      <span className="message-avatar avatar-fallback">{(message.author?.name || "P").slice(0, 1)}</span>}
    <div>
      <header><strong>{message.author?.name || "Pawline member"}</strong><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></header>
      <p>{message.body}</p>
      <LeadCard lead={message.linkPreview} />
      {!mine ? <button className="report-message" onClick={() => onReport(message.id)}><Flag />Report</button> : null}
    </div>
  </article>;
}

export default function Community({ onLeadsChange }) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { user } = useUser();
  const [messages, setMessages] = useState([]);
  const [leads, setLeads] = useState([]);
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState({ mode: "idle", message: "" });
  const [live, setLive] = useState({ connected: false, online: 0 });
  const endRef = useRef(null);
  const lastParsedUrl = useRef("");

  const authorizedFetch = async (url, options = {}) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } });
  };

  useEffect(() => {
    if (!isSignedIn) return undefined;
    let active = true;
    Promise.all([
      authorizedFetch("/api/community-messages").then((response) => json(response, "Community history is unavailable.")),
      authorizedFetch("/api/community-leads").then((response) => json(response, "Shared pets are unavailable.")),
    ]).then(([history, shared]) => {
      if (!active) return;
      setMessages(history.messages || []);
      setLeads(shared.leads || []);
      onLeadsChange(shared.leads || []);
    }).catch((error) => active && setStatus({ mode: "error", message: error.message }));

    let realtime;
    (async () => {
      realtime = new Ably.Realtime({
        authCallback: async (_params, callback) => {
          try {
            const response = await authorizedFetch("/api/ably-token");
            const token = await json(response, "Realtime authentication is unavailable.");
            if (!response.ok) throw new Error(token.error || "Realtime authentication failed.");
            callback(null, token);
          } catch (error) { callback(error, null); }
        },
      });
      realtime.connection.on("connected", () => active && setLive((value) => ({ ...value, connected: true })));
      realtime.connection.on("disconnected", () => active && setLive((value) => ({ ...value, connected: false })));
      realtime.connection.on("failed", () => active && setLive((value) => ({ ...value, connected: false })));
      const channel = realtime.channels.get("pawline:community");
      await channel.subscribe("message.created", (event) => {
        if (!active) return;
        setMessages((current) => current.some((item) => item.id === event.data.id) ? current : [...current, event.data].slice(-80));
      });
      channel.presence.subscribe(() => channel.presence.get().then((members) => active && setLive((value) => ({ ...value, online: members.length }))));
      await channel.presence.enter({ name: user?.firstName || "Member" });
      const members = await channel.presence.get();
      if (active) setLive((value) => ({ ...value, online: members.length }));
    })().catch(() => active && setLive({ connected: false, online: 0 }));
    return () => {
      active = false;
      realtime?.close();
    };
  }, [isSignedIn, userId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  useEffect(() => {
    if (!isSignedIn) return;
    const url = body.match(URL_PATTERN)?.[0] || "";
    if (!url || url === lastParsedUrl.current || preview?.sourceUrl === url) return;
    const timer = setTimeout(async () => {
      lastParsedUrl.current = url;
      setStatus({ mode: "parsing", message: "Reading the public listing and preparing a city-level map lead…" });
      try {
        const response = await authorizedFetch("/api/community-parse-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const result = await json(response, "Link parsing is unavailable.");
        if (!response.ok) throw new Error(result.error || "That link could not be parsed.");
        setPreview(result.lead);
        setLeads((current) => [result.lead, ...current.filter((lead) => lead.id !== result.lead.id)]);
        onLeadsChange((current) => [result.lead, ...(Array.isArray(current) ? current : []).filter((lead) => lead.id !== result.lead.id)]);
        setStatus({ mode: "success", message: "Draft created. It will stay marked Needs confirmation." });
      } catch (error) {
        setPreview(null);
        setStatus({ mode: "error", message: error.message });
      }
    }, 650);
    return () => clearTimeout(timer);
  }, [body, isSignedIn, preview?.sourceUrl]);

  const send = async (event) => {
    event.preventDefault();
    if (!body.trim()) return;
    setStatus({ mode: "sending", message: "Moderating and sending…" });
    try {
      const response = await authorizedFetch("/api/community-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, linkPreview: preview }),
      });
      const result = await json(response, "The message could not be sent.");
      if (!response.ok) throw new Error(result.error || "The message could not be sent.");
      setMessages((current) => current.some((item) => item.id === result.message.id) ? current : [...current, result.message]);
      setBody("");
      setPreview(null);
      lastParsedUrl.current = "";
      setStatus({ mode: "success", message: "Sent safely." });
    } catch (error) { setStatus({ mode: "error", message: error.message }); }
  };

  const report = async (messageId) => {
    try {
      const response = await authorizedFetch("/api/community-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, reason: "Community safety report" }),
      });
      const result = await json(response, "The report could not be sent.");
      if (!response.ok) throw new Error(result.error);
      setStatus({ mode: "success", message: result.message });
    } catch (error) { setStatus({ mode: "error", message: error.message }); }
  };

  if (!isLoaded) return <div className="community-auth-state"><LoaderCircle className="community-spinner" /><h2>Opening the community…</h2></div>;
  if (!isSignedIn) return <div className="community-auth-state">
    <span><MessageCircle /></span>
    <h2>Join the Pawline community</h2>
    <p>Create a basic account to talk about found pets, strays, and adoption listings. Your email stays private.</p>
    <SignInButton mode="modal"><button className="button">Sign in to join</button></SignInButton>
    <div className="auth-safety"><ShieldCheck /><span><strong>Privacy protected</strong>Exact addresses, phone numbers, emails, harassment, scams, and unsafe meetup requests are blocked.</span></div>
  </div>;

  return <div className="community-workspace">
    <section className="community-chat" aria-label="Community conversation">
      <header className="community-title">
        <div><h1>Community</h1><p>A kind place to help pets and each other.</p></div>
        <span className={live.connected ? "is-live" : ""}><i />{live.connected ? `Live${live.online ? ` · ${live.online} online` : ""}` : "Reconnecting"}</span>
        <UserButton />
      </header>
      <div className="privacy-strip"><LockKeyhole /><span><strong>Privacy protected</strong>Share city-level locations only. Private contact details and unsafe requests are blocked.</span></div>
      <div className="message-list" aria-live="polite">
        {!messages.length ? <div className="community-empty"><Users /><strong>Start the conversation</strong><p>Share a pet link or ask neighbors to keep an eye out.</p></div> :
          messages.map((message) => <Message key={message.id} message={message} currentUserId={userId} onReport={report} />)}
        <div ref={endRef} />
      </div>
      <form className="community-composer" onSubmit={send}>
        {preview ? <LeadCard lead={preview} /> : null}
        <label htmlFor="community-message">Share a pet or ask the community…</label>
        <textarea id="community-message" value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} placeholder="Paste a Pawline or outside listing link" />
        <footer><span><Link2 />Links are parsed into reviewable map leads</span><button className="button" disabled={status.mode === "sending" || status.mode === "parsing"}>{status.mode === "sending" ? <LoaderCircle className="community-spinner" /> : <Send />}Send</button></footer>
      </form>
      {status.message ? <p className={`community-status status-${status.mode}`} role={status.mode === "error" ? "alert" : "status"}>
        {status.mode === "error" ? <AlertTriangle /> : status.mode === "parsing" || status.mode === "sending" ? <LoaderCircle className="community-spinner" /> : <CheckCircle2 />}{status.message}
      </p> : null}
    </section>
    <aside className="shared-leads" aria-label="Pets shared on the map">
      <header><div><h2>Shared on map</h2><span>{leads.length}</span></div><p>Community links are approximate leads, not verified pet records.</p></header>
      <div className="lead-boundary"><ShieldCheck /><span><strong>Needs confirmation</strong>Confirm availability and details with the original source.</span></div>
      <div className="shared-lead-list">
        {leads.length ? leads.map((lead) => <LeadCard key={lead.id} lead={lead} />) :
          <div className="community-empty compact"><MapPin /><strong>No shared map leads yet</strong><p>Paste an outside pet listing into chat to add one.</p></div>}
      </div>
    </aside>
  </div>;
}

