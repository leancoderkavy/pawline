"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import AuthModal from "../../../src/AuthModal";
import { clerkBrowserOptions } from "../../../src/clerkBrowserOptions";

function Queue() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const response = await fetch("/api/privacy-requests", { cache: "no-store", headers: { Authorization: `Bearer ${await getToken()}` } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Queue unavailable.");
      setRequests(body.requests || []);
      setMessage("");
    } catch (error) { setMessage(error.message); }
  }, [getToken, isSignedIn]);
  useEffect(() => { load(); }, [load]);
  async function update(id, status) {
    try {
      const response = await fetch("/api/privacy-requests", { method: "PATCH", cache: "no-store", headers: {
        "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}`,
      }, body: JSON.stringify({ id, status }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Update failed.");
      await load();
    } catch (error) { setMessage(error.message); }
  }
  return <main className="methodology-page"><article className="methodology-content legal-content">
    <h1>Privacy requests</h1>
    {!isLoaded ? <p role="status">Checking sign-in…</p> : !isSignedIn ? <><p>Sign in with authorized operator account.</p><button onClick={() => setShowAuth(true)}>Sign in</button>{showAuth ? <AuthModal initialMode="signin" onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} /> : null}</> : <>
      <p>Verify identity before disclosing or changing data. Changing status does not process request.</p>
      <button onClick={load}>Refresh queue</button>
      <p role="status">{message}</p>
      <ul>{requests.map((item) => <li key={item.id}>
        <h2>{item.request_type} · {item.status}</h2>
        <p>Reference: {item.id}<br />Received: {new Date(item.created_at).toLocaleString()}<br />Contact: {item.contact_email}</p>
        {item.details ? <p>{item.details}</p> : null}
        <label>Update status <select value={item.status} onChange={(event) => update(item.id, event.target.value)}>
          {['received', 'verifying', 'in_progress', 'completed', 'denied'].map((status) => <option key={status} value={status}>{status}</option>)}
        </select></label>
      </li>)}</ul>
      {!requests.length && !message ? <p>No requests in queue.</p> : null}
    </>}
  </article></main>;
}

export default function PrivacyQueue() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  return key ? <ClerkProvider {...clerkBrowserOptions(key)}><Queue /></ClerkProvider> : <p>Identity service unavailable.</p>;
}
