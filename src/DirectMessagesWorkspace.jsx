"use client";
import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Flag, LoaderCircle, LockKeyhole, MessageCircle, PawPrint, RefreshCw, Search, Send, ShieldCheck, Video } from "lucide-react";
import "./directMessages.css";

const VideoCall = lazy(() => import("./VideoCall.jsx"));
const time = value => new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const mergeMessages = (old, next) => [...new Map([...old, ...next].map(message => [message.id, message])).values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || a.id.localeCompare(b.id));

function PetThumb({ listing }) {
  const [failed, setFailed] = useState(false);
  return listing.image && !failed ? <img className="direct-listing-thumb" src={listing.image} alt="" onError={() => setFailed(true)} /> : <span className="direct-listing-thumb direct-listing-fallback"><PawPrint /></span>;
}

export default function DirectMessagesWorkspace({ request, userId, accountControl, initialListing, onInitialListingHandled, onBrowse }) {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [olderCursor, setOlderCursor] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null);
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);
  const [video, setVideo] = useState(null);
  const selectedRef = useRef(null);
  const generation = useRef(0);
  const alive = useRef(true);
  const pendingSend = useRef(null);
  const listRequest = useRef(0);
  const threadRequest = useRef(0);
  const endRef = useRef(null);
  const scrollRef = useRef(null);
  const stickToBottom = useRef(true);
  const initialHandled = useRef(onInitialListingHandled);
  initialHandled.current = onInitialListingHandled;

  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current += 1; }; }, []);
  const errorNotice = useCallback(error => { if (alive.current) setNotice({ error: true, text: error.message }); }, []);

  const loadInbox = useCallback(async () => {
    const serial = ++listRequest.current;
    const result = await request("/api/direct-conversations");
    if (!alive.current || serial !== listRequest.current) return;
    setConversations(result.conversations || []);
    setRealtimeEnabled(Boolean(result.realtime));
    setLoading(false);
    const id = selectedRef.current;
    if (id) {
      const current = result.conversations.find(item => item.id === id);
      if (current) setSelected(current);
      else {
        selectedRef.current = null;
        generation.current += 1;
        setSelected(null);
        setMessages([]);
        setVideo(null);
      }
    }
  }, [request]);

  const loadThread = useCallback(async (id, { before = null, quiet = false } = {}) => {
    const currentGeneration = generation.current;
    const serial = ++threadRequest.current;
    if (!quiet) setThreadLoading(true);
    try {
      const result = await request(`/api/direct-messages?conversationId=${id}${before ? `&before=${before}` : ""}`);
      if (!alive.current || selectedRef.current !== id || currentGeneration !== generation.current || serial !== threadRequest.current) return;
      setMessages(current => before ? mergeMessages(result.messages, current) : mergeMessages(current.filter(message => result.messages[0] && new Date(message.createdAt) < new Date(result.messages[0].createdAt)), result.messages));
      if (before || !quiet) setOlderCursor(result.olderCursor);
      if (!before && result.messages.length && document.visibilityState === "visible") {
        await request("/api/direct-conversations", { method: "PATCH", body: JSON.stringify({ action: "read", conversationId: id, messageId: result.messages.at(-1).id }) });
        if (alive.current && selectedRef.current === id) setConversations(current => current.map(item => item.id === id ? { ...item, unreadCount: 0 } : item));
      }
    } catch (error) {
      if (selectedRef.current === id && currentGeneration === generation.current) {
        if (error.status === 401 || error.status === 404) { setMessages([]); setVideo(null); }
        errorNotice(error);
      }
    } finally { if (alive.current && serial === threadRequest.current) setThreadLoading(false); }
  }, [request, errorNotice]);

  const selectConversation = useCallback(conversation => {
    generation.current += 1;
    selectedRef.current = conversation?.id || null;
    setSelected(conversation);
    setMessages([]);
    setOlderCursor(null);
    setNotice(null);
    stickToBottom.current = true;
    if (conversation) loadThread(conversation.id);
  }, [loadThread]);

  useEffect(() => {
    let cancelled = false;
    let timer;
    let refreshing = false;
    const refresh = async () => {
      if (cancelled || refreshing) return;
      refreshing = true;
      try {
        if (document.visibilityState === "visible") {
          await loadInbox();
          if (selectedRef.current) await loadThread(selectedRef.current, { quiet: true });
        }
      } catch (error) { errorNotice(error); if (alive.current) setLoading(false); }
      refreshing = false;
      if (!cancelled) timer = setTimeout(refresh, 5000);
    };
    const wake = () => { if (document.visibilityState === "visible") { clearTimeout(timer); refresh(); } };
    refresh();
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    return () => { cancelled = true; clearTimeout(timer); window.removeEventListener("online", wake); document.removeEventListener("visibilitychange", wake); };
  }, [loadInbox, loadThread, errorNotice]);

  useEffect(() => {
    if (!initialListing?.id) return;
    let cancelled = false;
    const start = async () => {
      try {
        const result = await request("/api/direct-conversations", { method: "POST", body: JSON.stringify({ listingId: initialListing.id }) });
        if (cancelled) return;
        await loadInbox();
        if (!cancelled) selectConversation(result.conversation);
      } catch (error) { if (!cancelled) errorNotice(error); }
      finally { if (!cancelled) initialHandled.current?.(); }
    };
    start();
    return () => { cancelled = true; };
  }, [initialListing?.id, request, loadInbox, selectConversation, errorNotice]);

  useEffect(() => {
    if (!realtimeEnabled || !userId) return;
    let disposed = false;
    let realtime;
    (async () => {
      const { default: Ably } = await import("ably");
      if (disposed) return;
      realtime = new Ably.Realtime({ authCallback: async (_params, callback) => {
        try { callback(null, await request("/api/ably-token")); } catch (error) { callback(error, null); }
      } });
      await realtime.channels.get(`pawline:direct:${userId}`).subscribe(() => {
        if (disposed) return;
        loadInbox().catch(errorNotice);
        if (selectedRef.current) loadThread(selectedRef.current, { quiet: true });
      });
    })().catch(() => { /* The authenticated polling path remains active. */ });
    return () => { disposed = true; realtime?.close(); };
  }, [realtimeEnabled, userId, request, loadInbox, loadThread, errorNotice]);

  useEffect(() => {
    if (stickToBottom.current && endRef.current) endRef.current.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const body = drafts[selected?.id] || "";
  const setBody = value => setDrafts(current => ({ ...current, [selected.id]: value }));
  const send = async event => {
    event.preventDefault();
    if (!selected || !body.trim() || pendingSend.current?.sending) return;
    const id = selected.id;
    const draft = body;
    const previous = pendingSend.current;
    const clientMessageId = previous?.conversationId === id && previous.body === draft ? previous.clientMessageId : crypto.randomUUID();
    pendingSend.current = { conversationId: id, body: draft, clientMessageId, sending: true };
    setSending(true);
    setNotice(null);
    try {
      const result = await request("/api/direct-messages", { method: "POST", body: JSON.stringify({ conversationId: id, body: draft, clientMessageId }) });
      if (!alive.current) return;
      setDrafts(current => current[id] === draft ? { ...current, [id]: "" } : current);
      if (selectedRef.current === id) { threadRequest.current += 1; setThreadLoading(false); stickToBottom.current = true; setMessages(current => mergeMessages(current, [result.message])); }
      pendingSend.current = null;
      await loadInbox();
    } catch (error) { errorNotice(error); }
    finally { if (pendingSend.current) pendingSend.current.sending = false; if (alive.current) setSending(false); }
  };

  const changeConversation = async action => {
    const id = selected.id;
    try {
      const result = await request("/api/direct-conversations", { method: "PATCH", body: JSON.stringify({ conversationId: id, action }) });
      if (selectedRef.current === id) setSelected(result.conversation);
      await loadInbox();
    } catch (error) { errorNotice(error); }
  };
  const report = async messageId => {
    try {
      const result = await request("/api/direct-message-report", { method: "POST", body: JSON.stringify({ messageId }) });
      setNotice({ text: result.message });
    } catch (error) { errorNotice(error); }
  };
  const openVideo = async (conversation, invitation = null) => {
    try {
      const result = await request(`/api/direct-video?conversationId=${conversation.id}`);
      if (!result.enabled) { setNotice({ text: result.reason }); return; }
      setVideo({ conversation, invitation });
    } catch (error) { errorNotice(error); }
  };

  const visible = conversations.filter(item => {
    const text = `${item.listing.name} ${item.other.name} ${item.listing.shelter} ${item.preview}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (filter === "all" || filter === "unread" && item.unreadCount > 0 || filter === "team" && item.role === "listing_contact" || item.status === filter);
  });
  const incoming = conversations.find(item => item.incomingCall && !item.blocked && item.status === "open");
  const paused = selected?.blocked || selected?.status === "resolved";
  return <div className="chat-feature">
    {notice ? <div className={`chat-notice ${notice.error ? "chat-error" : ""}`} role={notice.error ? "alert" : "status"}><span>{notice.text}</span><button type="button" className="chat-icon" aria-label="Dismiss message" onClick={() => setNotice(null)}>×</button>{notice.error ? <button type="button" onClick={() => { setNotice(null); loadInbox().then(() => selectedRef.current && loadThread(selectedRef.current)).catch(errorNotice); }}>Retry</button> : null}</div> : null}
    {incoming && !video ? <div className="chat-incoming" role="status"><Video /><span><strong>{incoming.incomingCall.callerName} is calling</strong><small>About {incoming.listing.name}</small></span><button type="button" className="button" onClick={() => openVideo(incoming, incoming.incomingCall)}>Review invitation</button><button type="button" onClick={async () => { try { await request("/api/direct-video", { method: "POST", body: JSON.stringify({ conversationId: incoming.id, callId: incoming.incomingCall.id, action: "decline" }) }); await loadInbox(); } catch (error) { errorNotice(error); } }}>Decline</button></div> : null}
    <div className={`direct-workspace ${selected ? "has-selection" : ""}`}>
      <aside className="direct-inbox-list" aria-label="Private conversations">
        <header><div><p className="chat-eyebrow">A little closer to home</p><h1>Messages</h1><p>Questions, answers, and first hellos.</p></div>{accountControl}</header>
        <div className="chat-inbox-tools"><label className="chat-search"><Search /><span className="sr-only">Search conversations</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search pets or people" /></label><div><select aria-label="Filter conversations" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All conversations</option><option value="unread">Unread</option><option value="open">Open questions</option><option value="resolved">Resolved</option><option value="team">Caregiver inbox</option></select><button type="button" className="chat-icon" aria-label="Refresh conversations" onClick={() => loadInbox().catch(errorNotice)}><RefreshCw /></button></div></div>
        <div className="direct-inbox-scroll">{loading ? <p className="chat-loading" role="status"><LoaderCircle />Loading conversations…</p> : visible.length ? visible.map(item => <button type="button" key={item.id} className={`direct-conversation-row ${selected?.id === item.id ? "is-active" : ""}`} aria-current={selected?.id === item.id ? "true" : undefined} onClick={() => selectConversation(item)}><PetThumb listing={item.listing} /><span><strong>{item.listing.name}{item.unreadCount ? <b className="chat-unread" aria-label={`${item.unreadCount} unread messages`}>{item.unreadCount}</b> : null}</strong><small>{item.other.name}</small><em>{item.preview}</em><span className="chat-row-meta">{item.incomingCall ? "Incoming call" : item.blocked ? "Blocked" : item.status === "resolved" ? "Resolved" : item.role === "listing_contact" ? "Adoption question" : "Private conversation"} · {time(item.lastMessageAt)}</span></span></button>) : <div className="direct-empty compact"><MessageCircle /><strong>{conversations.length ? "No matching conversations" : "Every adoption starts with a question"}</strong><p>{conversations.length ? "Try another name or filter." : "Ask a shelter, rescue, or foster caregiver a question from a pet's listing. Caregivers receive and answer questions here."}</p>{!conversations.length ? <button type="button" className="button" onClick={onBrowse}>Find a pet</button> : null}</div>}</div>
        <footer className="chat-inbox-note"><LockKeyhole />Private to you and the shelter or caretaker.</footer>
      </aside>
      <section className="direct-thread" aria-label="Private conversation">
        {selected ? <>
          <header className="direct-thread-title"><button type="button" className="direct-mobile-back" aria-label="Back to conversations" onClick={() => selectConversation(null)}><ArrowLeft /></button><PetThumb listing={selected.listing} /><div><h2>{selected.listing.name}</h2><p>{selected.other.name}{selected.organization ? (selected.role === "listing_contact" ? " · Adoption inquiry" : " · Shelter team") : ""}</p></div><button type="button" className="chat-video-button" aria-label="Video call" disabled={paused} onClick={() => openVideo(selected)}><Video /><span>Video call</span></button></header>
          <div className="chat-thread-tools"><span><ShieldCheck />{selected.organization ? "Shared with the caregiver team" : "Private listing conversation"}</span><button type="button" onClick={() => changeConversation(selected.status === "resolved" ? "reopen" : "resolve")}>{selected.status === "resolved" ? "Reopen" : "Mark resolved"}</button><button type="button" disabled={selected.blocked && !selected.blockedByMe} onClick={() => changeConversation(selected.blockedByMe ? "unblock" : "block")}>{selected.blockedByMe ? "Unblock" : "Block"}</button></div>
          <div className="direct-message-list" role="log" aria-label="Messages in this conversation" ref={scrollRef} onScroll={() => { const el = scrollRef.current; stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }}>
            {selected.lastCall ? <p className="chat-call-history"><Video size={14} />Video call · {selected.lastCall.state === "accepted" ? "In progress" : selected.lastCall.state === "ringing" ? "Invitation sent" : selected.lastCall.state} · {time(selected.lastCall.createdAt)}</p> : null}
            {olderCursor ? <button type="button" className="chat-load-older" disabled={threadLoading} onClick={() => { stickToBottom.current = false; loadThread(selected.id, { before: olderCursor }); }}>Load older messages</button> : null}
            {threadLoading && !messages.length ? <p role="status">Loading messages…</p> : !messages.length ? <div className="direct-empty"><MessageCircle /><strong>What would you like to know?</strong><p>Ask about daily routines, other pets, or the adoption process.</p></div> : messages.map(message => <article key={message.id} className={`direct-message ${message.mine ? "is-mine" : ""}`}><div>{!message.mine ? <strong>{message.author.name}</strong> : null}<p>{message.body}</p><footer><time dateTime={message.createdAt} title={new Date(message.createdAt).toLocaleString()}>{time(message.createdAt)}</time>{message.mine ? <span><Check size={12} /> Sent</span> : <button type="button" aria-label={`Report message from ${message.author.name} at ${time(message.createdAt)}`} onClick={() => report(message.id)}><Flag />Report</button>}</footer></div></article>)}
            <div ref={endRef} />
          </div>
          {paused ? <div className="chat-paused" role="status"><LockKeyhole /><p>{selected.blocked ? "Messages and calls are paused while this conversation is blocked." : "This question is resolved. Reopen it whenever you need to follow up."}</p></div> : <form className="direct-composer" onSubmit={send}>
            {!body && !messages.length ? <div className="chat-prompts">{(selected.role === "listing_contact" ? ["Thanks for reaching out! What would you like to know?", "Would you like to arrange a video call?"] : ["How are they around other pets?", "What does a typical day look like?", "What are the next steps to adopt?"]).map(prompt => <button key={prompt} type="button" onClick={() => setBody(prompt)}>{prompt}</button>)}</div> : null}
            <label htmlFor="direct-message">{selected.role === "listing_contact" ? `Reply to ${selected.other.name}` : `Ask about ${selected.listing.name}`}</label>
            <textarea id="direct-message" value={body} maxLength={2000} onChange={event => setBody(event.target.value)} placeholder="Write a message…" onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); send(event); } }} />
            <footer><span>{body.length}/2,000 · Ctrl/⌘ + Enter to send</span><button type="submit" className="button" disabled={sending || !body.trim()}>{sending ? <LoaderCircle /> : <Send />}{sending ? "Sending…" : "Send"}</button></footer>
          </form>}
        </> : <div className="direct-empty direct-thread-empty"><PawPrint /><p className="chat-eyebrow">Good questions. Better matches.</p><strong>Get to know them, together.</strong><p>Choose a conversation to ask questions, hear from the shelter, or arrange a video hello.</p><button type="button" className="button" onClick={onBrowse}>Explore pets</button></div>}
      </section>
    </div>
    {video ? <Suspense fallback={<p role="status">Opening video call…</p>}><VideoCall request={request} conversation={video.conversation} invitation={video.invitation} onClose={() => { setVideo(null); loadInbox().catch(errorNotice); }} /></Suspense> : null}
  </div>;
}
