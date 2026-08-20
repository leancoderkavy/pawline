"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import AuthModal from "../../../src/AuthModal";

function ClaimForm({ token, onConsumed }) {
  const { getToken } = useAuth();
  const [state, setState] = useState("ready");
  const [message, setMessage] = useState("");

  const redeem = async () => {
    if (!token) { setState("error"); setMessage("This claim link is invalid or expired."); return; }
    setState("working"); setMessage("");
    try {
      const response = await fetch("/api/organization-claim", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ token }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "This claim link could not be used.");
      onConsumed?.(); setState("success"); setMessage("Your organization is now connected to this Pawline account.");
    } catch (error) { setState("error"); setMessage(error.message || "This claim link could not be used."); }
  };

  return <main style={styles.shell}><section style={styles.card} aria-labelledby="claim-title">
    <p style={styles.eyebrow}>Pawline organizations</p><h1 id="claim-title" style={styles.title}>Claim your organization profile</h1>
    <p>Confirm that you are authorized to manage this organization. Your account’s verified email must match the official address that received this invitation.</p>
    {state === "success" ? <><p role="status" style={styles.success}>{message}</p><a href="/" style={styles.link}>Open Pawline</a></> : <>
      {message ? <p role="alert" style={styles.error}>{message}</p> : null}
      <button type="button" style={styles.button} disabled={state === "working"} onClick={redeem}>
        {state === "working" ? "Confirming…" : "Claim organization"}
      </button>
      <p style={styles.note}>This link expires after seven days and can be used once. Pawline identity confirmation is not an animal-care endorsement.</p>
    </>}
  </section></main>;
}

function ClaimFlow() {
  const { isLoaded, isSignedIn } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    const supplied = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    // Capture the fragment before authentication UI can navigate. It remains
    // only in this client component's memory while Clerk's modal completes.
    if (supplied) {
      setToken(supplied);
      window.history.replaceState(null, "", "/shelter/claim");
    }
  }, []);

  // Keep protected content unmounted until Clerk has determined the session.
  // The API independently verifies the bearer token and recipient email.
  if (!isLoaded) return <main style={styles.shell}><section style={styles.card}><p role="status">Checking sign-in status…</p></section></main>;
  if (!isSignedIn) return <main style={styles.shell}><section style={styles.card}><h1 style={styles.title}>Sign in to claim this organization</h1><p>Use the Pawline account with the verified email that received the invitation.</p><button type="button" style={styles.button} onClick={() => setShowAuthModal(true)}>Sign in</button>{showAuthModal ? <AuthModal initialMode="signin" onClose={() => setShowAuthModal(false)} onSuccess={() => setShowAuthModal(false)} /> : null}</section></main>;
  return <ClaimForm token={token} onConsumed={() => setToken("")} />;
}

export default function ClaimOrganizationPage() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  if (!publishableKey) return <main style={styles.shell}><section style={styles.card}><h1 style={styles.title}>Organization claiming is unavailable</h1><p>Pawline identity services are not configured for this environment.</p></section></main>;
  return <ClerkProvider publishableKey={publishableKey}><ClaimFlow /></ClerkProvider>;
}

const styles = {
  shell: { minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "#f6f2e8", color: "#173b2a" },
  card: { boxSizing: "border-box", width: "min(100%, 580px)", padding: 28, borderRadius: 16, border: "1px solid #d6ded6", background: "#fffdf8", lineHeight: 1.55 },
  title: { margin: "0 0 16px", fontSize: "clamp(2.15rem, 10.5vw, 3.6rem)", lineHeight: 0.98, letterSpacing: "-.04em", overflowWrap: "anywhere" },
  eyebrow: { color: "#6a2f17", fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 700 },
  button: { minHeight: 44, padding: "10px 15px", border: 0, borderRadius: 8, background: "#174d36", color: "#fff", fontWeight: 700, cursor: "pointer" },
  link: { color: "#174d36", fontWeight: 700 }, error: { color: "#a32d20" }, success: { color: "#174d36", fontWeight: 700 }, note: { fontSize: ".88rem", color: "#526b5d", marginTop: 16 },
};
