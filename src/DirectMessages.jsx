"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Ably from "ably";
import { UserButton, useAuth } from "@clerk/nextjs";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Flag, LoaderCircle, LockKeyhole,
  MessageCircle, PawPrint, Send, ShieldCheck, Users,
} from "lucide-react";
import AuthModal from "./AuthModal";

async function json(response, fallback) {
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error(fallback);
  return response.json();
}

function ListingThumb({ listing }) {
  return listing?.image
    ? <img className="direct-listing-thumb" src={listing.image} alt="" />
    : <span className="direct-listing-thumb direct-listing-fallback"><PawPrint /></span>;
}

function ConversationRow({ conversation, active, onClick }) {
  return <button type="button" className={`direct-conversation-row ${active ? "is-active" : ""}`} onClick={onClick}>
    <ListingThumb listing={conversation.listing} />
    <span>
      <strong>{conversation.listing.name}</strong>
      <small>{conversation.other.name || conversation.listing.shelter || "Pawline caretaker"}</small>
      <em>{conversation.role === "listing_contact" ? "Adoption inquiry" : "Private conversation"}</em>
    </span>
  </button>;
}

function DirectMessage({ message, onReport }) {
  return <article className={`direct-message ${message.mine ? "is-mine" : ""}`}>
    {!message.mine ? (message.author.imageUrl
      ? <img className="direct-message-avatar" src={message.author.imageUrl} alt="" />
      : <span className="direct-message-avatar direct-avatar-fallback">{(message.author.name || "P").slice(0, 1)}</span>) : null}
    <div>
      {!message.mine ? <strong>{message.author.name || "Pawline member"}</strong> : null}
      <p>{message.body}</p>
      <footer><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>{!message.mine ? <button type="button" onClick={() => onReport(message.id)}><Flag />Report</button> : null}</footer>
    </div>
  </article>;
}

function SafetyRail({ conversation }) {
  return <aside className="direct-safety-rail" aria-label="Private-message safety guidance">
    <div className="direct-private-note"><span><LockKeyhole /></span><h2>Private to this listing</h2><p>{conversation ? `Messages about ${conversation.listing.name} are visible only to both participants.` : "Private conversations are visible only to the people in them."}</p></div>
    <div className="direct-safety-copy"><h3>Safe messaging</h3><p>Keep contact details, payment requests, and exact home addresses off Pawline.</p><ul>
      <li><ShieldCheck />Keep the conversation here</li>
      <li><Users />Meet in a safe public place</li>
      <li><Flag />Report anything suspicious</li>
    </ul></div>
  </aside>;
}

export default function DirectMessages({ initialListing, onInitialListingHandled, onBrowse }) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("signin");
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState({ mode: "idle", message: "" });
  const selectedIdRef = useRef(null);
  const openedListingRef = useRef("");
  const endRef = useRef(null);

  useEffect(() => { selectedIdRef.current = selected?.id || null; }, [selected]);

  const authorizedFetch = useCallback(async (url, options = {}) => {
    const token = await getToken();
    if (!token) throw new Error("Sign in with Pawline to use private messages.");
    return fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } });
  }, [getToken]);

  const loadConversations = useCallback(async () => {
    const response = await authorizedFetch("/api/direct-conversations");
    const result = await json(response, "Private conversations are unavailable.");
    if (!response.ok) throw new Error(result.error || "Private conversations are unavailable.");
    setConversations(result.conversations || []);
    return result.conversations || [];
  }, [authorizedFetch]);

  const loadMessages = useCallback(async (conversation) => {
    if (!conversation) return;
    setStatus({ mode: "loading", message: "Opening conversation…" });
    try {
      const response = await authorizedFetch(`/api/direct-messages?conversationId=${encodeURIComponent(conversation.id)}`);
      const result = await json(response, "Messages are unavailable.");
      if (!response.ok) throw new Error(result.error || "Messages are unavailable.");
      setSelected(conversation);
      setMessages(result.messages || []);
      setStatus({ mode: "idle", message: "" });
    } catch (error) { setStatus({ mode: "error", message: error.message }); }
  }, [authorizedFetch]);

  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    loadConversations().then((items) => {
      if (active && items.length) loadMessages(items[0]);
    }).catch((error) => active && setStatus({ mode: "error", message: error.message }));
    return () => { active = false; };
  }, [isSignedIn, loadConversations, loadMessages]);

  useEffect(() => {
    if (!isSignedIn || !initialListing?.id || openedListingRef.current === initialListing.id) return;
    let active = true;
    openedListingRef.current = initialListing.id;
    setStatus({ mode: "opening", message: "Starting a private conversation…" });
    authorizedFetch("/api/direct-conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: initialListing.id }),
    }).then(async (response) => {
      const result = await json(response, "Private messaging is unavailable.");
      if (!response.ok) throw new Error(result.error || "Private messaging is unavailable.");
      if (!active) return;
      setConversations((current) => [result.conversation, ...current.filter((item) => item.id !== result.conversation.id)]);
      await loadMessages(result.conversation);
      setStatus({ mode: "success", message: `You can now message ${result.conversation.other.name || result.conversation.listing.shelter}.` });
    }).catch((error) => active && setStatus({ mode: "error", message: error.message })).finally(() => onInitialListingHandled?.());
    return () => { active = false; };
  }, [authorizedFetch, initialListing?.id, isSignedIn, loadMessages, onInitialListingHandled]);

  useEffect(() => {
    if (!isSignedIn || !userId) return undefined;
    let active = true;
    let realtime;
    (async () => {
      realtime = new Ably.Realtime({
        authCallback: async (_params, callback) => {
          try {
            const response = await authorizedFetch("/api/ably-token");
            const token = await json(response, "Realtime messaging is unavailable.");
            if (!response.ok) throw new Error(token.error || "Realtime authentication failed.");
            callback(null, token);
          } catch (error) { callback(error, null); }
        },
      });
      const channel = realtime.channels.get(`pawline:direct:${userId}`);
      await channel.subscribe("message.created", (event) => {
        if (!active || !event.data?.conversationId) return;
        setConversations((current) => current.map((item) => item.id === event.data.conversationId ? { ...item, lastMessageAt: event.data.createdAt } : item)
          .sort((left, right) => new Date(right.lastMessageAt) - new Date(left.lastMessageAt)));
        if (selectedIdRef.current === event.data.conversationId) {
          setMessages((current) => current.some((item) => item.id === event.data.id) ? current : [...current, event.data]);
        }
      });
    })().catch(() => {});
    return () => { active = false; realtime?.close(); };
  }, [authorizedFetch, isSignedIn, userId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const send = async (event) => {
    event.preventDefault();
    if (!selected || !body.trim()) return;
    setStatus({ mode: "sending", message: "Sending safely…" });
    try {
      const response = await authorizedFetch("/api/direct-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selected.id, body }),
      });
      const result = await json(response, "The message could not be sent.");
      if (!response.ok) throw new Error(result.error || "The message could not be sent.");
      setMessages((current) => current.some((item) => item.id === result.message.id) ? current : [...current, result.message]);
      setConversations((current) => current.map((item) => item.id === selected.id ? { ...item, lastMessageAt: result.message.createdAt } : item)
        .sort((left, right) => new Date(right.lastMessageAt) - new Date(left.lastMessageAt)));
      setBody("");
      setStatus({ mode: "success", message: "Sent safely." });
    } catch (error) { setStatus({ mode: "error", message: error.message }); }
  };

  const report = async (messageId) => {
    try {
      const response = await authorizedFetch("/api/direct-message-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, reason: "Private-message safety report" }),
      });
      const result = await json(response, "The report could not be sent.");
      if (!response.ok) throw new Error(result.error || "The report could not be sent.");
      setStatus({ mode: "success", message: result.message });
    } catch (error) { setStatus({ mode: "error", message: error.message }); }
  };

  if (!isLoaded) return <div className="community-auth-state"><LoaderCircle className="community-spinner" /><h2>Opening Messages…</h2></div>;
  if (!isSignedIn) return <div className="community-auth-state">
    {showAuthModal ? <AuthModal initialMode={authMode} onClose={() => setShowAuthModal(false)} onSuccess={() => setShowAuthModal(false)} /> : null}
    <span><MessageCircle /></span><h2>Message a shelter or foster</h2>
    <p>Sign in to register a pet, ask about a Pawline listing, or respond as its caretaker. Your contact details stay private.</p>
    <div className="auth-actions">
      <button className="button" onClick={() => { setAuthMode("signup"); setShowAuthModal(true); }}>Create account</button>
      <button className="button button-outline" onClick={() => { setAuthMode("signin"); setShowAuthModal(true); }}>Sign in</button>
    </div>
    <div className="auth-safety"><ShieldCheck /><span><strong>Private by design</strong>Every conversation is tied to one listing and protected by Pawline moderation.</span></div>
  </div>;

  const returnToInbox = () => {
    setSelected(null);
    setMessages([]);
    setBody("");
    setStatus({ mode: "idle", message: "" });
  };

  return <div className={`direct-workspace ${selected ? "has-selection" : ""}`}>
    <aside className="direct-inbox-list" aria-label="Private conversations">
      <header><div><h1>Conversations</h1><p>Private adoption questions and replies.</p></div><UserButton /></header>
      <div className="direct-inbox-scroll">
        {conversations.length ? conversations.map((conversation) => <ConversationRow key={conversation.id} conversation={conversation} active={selected?.id === conversation.id} onClick={() => loadMessages(conversation)} />)
          : <div className="direct-empty compact"><MessageCircle /><strong>No conversations yet</strong><p>Open a Pawline-listed pet to begin.</p><button type="button" className="button" onClick={onBrowse}>Find a pet</button></div>}
      </div>
    </aside>
    <section className="direct-thread" aria-label="Private conversation">
      {selected ? <>
        <header className="direct-thread-title"><button type="button" className="direct-mobile-back" aria-label="Back to conversations" onClick={returnToInbox}><ArrowLeft /></button><ListingThumb listing={selected.listing} /><div><h2>{selected.listing.name}</h2><p>{selected.listing.shelter || selected.other.name} · {selected.role === "listing_contact" ? "Adoption inquiry" : "Private conversation"}</p></div></header>
        <div className="direct-privacy-strip"><LockKeyhole />Private to this listing. Keep personal contact details and payments off Pawline.</div>
        <div className="direct-message-list" aria-live="polite">
          {!messages.length ? <div className="direct-empty"><MessageCircle /><strong>Start the conversation</strong><p>Ask about routine, behavior, medical history, or the adoption process.</p></div> : messages.map((message) => <DirectMessage key={message.id} message={message} onReport={report} />)}
          <div ref={endRef} />
        </div>
        <form className="direct-composer" onSubmit={send}>
          <label htmlFor="direct-message">Message about {selected.listing.name}</label>
          <textarea id="direct-message" value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} placeholder={selected.role === "listing_contact" ? "Reply to this adoption question…" : "Ask a thoughtful question…"} />
          <footer><span><ShieldCheck />Private, moderated messaging</span><button className="button" disabled={status.mode === "sending"}>{status.mode === "sending" ? <LoaderCircle className="community-spinner" /> : <Send />}Send</button></footer>
        </form>
      </> : <div className="direct-empty direct-thread-empty"><PawPrint /><strong>Find a pet you’d like to meet</strong><p>When a Pawline caretaker has enabled messaging, you can start a private conversation right from the listing.</p><button type="button" className="button" onClick={onBrowse}>Explore listings</button></div>}
      {status.message ? <p className={`direct-status status-${status.mode}`} role={status.mode === "error" ? "alert" : "status"}>{status.mode === "error" ? <AlertTriangle /> : status.mode === "loading" || status.mode === "opening" || status.mode === "sending" ? <LoaderCircle className="community-spinner" /> : <CheckCircle2 />}{status.message}</p> : null}
    </section>
    <SafetyRail conversation={selected} />
  </div>;
}
