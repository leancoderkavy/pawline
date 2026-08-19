"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { buildApplicationCoachRequest, manualCoachGuidance, validateApplicationCoachSuggestion } from "./adopterJourney";

async function readJson(response) {
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("The application helper returned an invalid response.");
  return response.json();
}

export default function ApplicationCoach({ question, answer, onAccept, getToken }) {
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState({ status: "idle", suggestion: null, message: "" });
  const requestSuggestion = async () => {
    if (typeof getToken !== "function") {
      setState({ status: "manual", suggestion: null, message: "Sign in to request an AI-assisted suggestion. You can still edit this answer yourself. " + manualCoachGuidance(answer) });
      return;
    }
    const prepared = buildApplicationCoachRequest({ question, answer, consentToAiProcessing: consent });
    if (prepared.error) {
      setState({ status: "error", suggestion: null, message: prepared.error });
      return;
    }
    setState({ status: "loading", suggestion: null, message: "" });
    try {
      const token = await getToken();
      if (!token) throw new Error("Sign in to use the application helper.");
      const response = await fetch("/api/application-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(prepared.value),
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.error || "The application helper is unavailable.");
      const suggestion = validateApplicationCoachSuggestion(payload.suggestion);
      if (!suggestion) throw new Error("The application helper returned an incomplete suggestion.");
      setState({ status: "ready", suggestion, message: "" });
    } catch (error) {
      setState({ status: "manual", suggestion: null, message: `${error.message} ${manualCoachGuidance(answer)}` });
    }
  };

  return <section className="application-coach" aria-labelledby="application-coach-title">
    <div className="application-coach-heading"><span aria-hidden="true"><Sparkles /></span><div><h3 id="application-coach-title">Optional writing help</h3><p>Get a clear, factual draft. Pawline will not write around a shelter’s requirements or submit anything for you.</p></div></div>
    <label className="coach-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> <span>I agree to send only this answer and question for an AI-assisted suggestion.</span></label>
    <button type="button" className="coach-action" onClick={requestSuggestion} disabled={!answer.trim() || !consent || state.status === "loading"}>{state.status === "loading" ? "Preparing suggestion…" : "Help me improve this answer"}</button>
    {state.status === "manual" ? <p className="coach-manual" role="status"><CheckCircle2 /> {state.message}</p> : null}
    {state.status === "error" ? <p className="coach-error" role="alert"><AlertTriangle /> {state.message}</p> : null}
    {state.suggestion ? <div className="coach-suggestion" aria-live="polite"><p className="eyebrow">Suggested revision</p><p>{state.suggestion.suggestion}</p><small>{state.suggestion.explanation}</small>{state.suggestion.missingDetails.length ? <ul>{state.suggestion.missingDetails.map(item => <li key={item}>{item}</li>)}</ul> : null}<div><button type="button" onClick={() => onAccept(state.suggestion.suggestion)}>Use suggestion</button><button type="button" onClick={() => setState({ status: "idle", suggestion: null, message: "" })}>Discard</button></div></div> : null}
  </section>;
}
