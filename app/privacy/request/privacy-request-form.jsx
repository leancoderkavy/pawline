"use client";

import { useState } from "react";

export default function PrivacyRequestForm() {
  const [state, setState] = useState({ status: "idle", message: "" });
  async function submit(event) {
    event.preventDefault();
    setState({ status: "sending", message: "" });
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/privacy-requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: form.get("type"), email: form.get("email"), details: form.get("details") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Request could not be sent.");
      event.currentTarget.reset();
      setState({ status: "sent", message: `Request received. Reference: ${result.id}` });
    } catch (error) { setState({ status: "error", message: error.message }); }
  }
  return <form onSubmit={submit}>
    <p><label htmlFor="privacy-type">Request type</label><br /><select id="privacy-type" name="type" required><option value="access">Access</option><option value="correction">Correction</option><option value="deletion">Deletion</option><option value="other">Other privacy question</option></select></p>
    <p><label htmlFor="privacy-email">Contact email</label><br /><input id="privacy-email" name="email" type="email" autoComplete="email" maxLength={254} required /></p>
    <p><label htmlFor="privacy-details">Details (optional)</label><br /><textarea id="privacy-details" name="details" maxLength={2000} rows={5} /></p>
    <button type="submit" disabled={state.status === "sending"}>{state.status === "sending" ? "Sending…" : "Send request"}</button>
    <p role="status" aria-live="polite">{state.message}</p>
  </form>;
}
