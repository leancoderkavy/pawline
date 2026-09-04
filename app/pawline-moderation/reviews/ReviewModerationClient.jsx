"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import AuthModal from "../../../src/AuthModal";

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Review moderation is temporarily unavailable.");
  return payload;
}

function ReviewQueue() {
  const { getToken } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [state, setState] = useState({ loading: true, error: "" });
  const load = useCallback(async () => {
    try {
      setState({ loading: true, error: "" });
      const result = await readResponse(await fetch("/api/organization-reviews?moderation=true", {
        headers: { Authorization: `Bearer ${await getToken()}` }, cache: "no-store",
      }));
      setReviews(result.reviews || []);
      setState({ loading: false, error: "" });
    } catch (error) { setState({ loading: false, error: error.message }); }
  }, [getToken]);
  useEffect(() => { load(); }, [load]);
  const moderate = async (reviewId, decision) => {
    try {
      await readResponse(await fetch("/api/organization-reviews", {
        method: "POST", cache: "no-store", headers: {
          "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}`,
        }, body: JSON.stringify({ action: "moderate", reviewId, decision }),
      }));
      await load();
    } catch (error) { setState((current) => ({ ...current, error: error.message })); }
  };
  return <main style={styles.shell}><section style={styles.card} aria-labelledby="moderation-title">
    <p style={styles.eyebrow}>Pawline staff</p><h1 id="moderation-title">Verified review moderation</h1>
    <p style={styles.note}>Publish only factual, safety-screened verified interactions. Rejecting a review removes it from public organization summaries. Evidence remains unavailable in this release.</p>
    {state.error ? <p role="alert" style={styles.error}>{state.error}</p> : null}
    {state.loading ? <p role="status">Loading review queue…</p> : reviews.length ? <ul style={styles.list}>{reviews.map((review) => <li key={review.id} style={styles.item}>
      <strong>{review.organizationName || "Organization"} · {review.rating}/5</strong>
      <p>{review.narrative}</p><small>{review.interactionType} · {review.interactionAt || "date unavailable"} · {review.moderationState}</small>
      {review.appeal ? <p style={styles.appeal}>Open appeal: {review.appeal.reason || "No reason available"}</p> : null}
      <div style={styles.actions}><button type="button" style={styles.button} onClick={() => moderate(review.id, "publish")}>Publish</button><button type="button" style={{ ...styles.button, ...styles.reject }} onClick={() => moderate(review.id, "reject")}>Reject</button></div>
    </li>)}</ul> : <p role="status">No verified reviews are awaiting moderation.</p>}
  </section></main>;
}

function ReviewModerationGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  // Do not mount the queue or issue authenticated requests until Clerk has
  // confirmed a session. The API remains the role authorization boundary.
  if (!isLoaded) return <main style={styles.shell}><section style={styles.card}><p role="status">Checking sign-in status…</p></section></main>;
  if (!isSignedIn) return <main style={styles.shell}><section style={styles.card}><h1>Sign in to moderate reviews</h1><button type="button" style={styles.button} onClick={() => setShowAuthModal(true)}>Sign in</button>{showAuthModal ? <AuthModal initialMode="signin" onClose={() => setShowAuthModal(false)} onSuccess={() => setShowAuthModal(false)} /> : null}</section></main>;
  return <ReviewQueue />;
}

export default function ReviewModerationPage({ embedded = false }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  if (!publishableKey) return <main style={styles.shell}><section style={styles.card}><h1>Review moderation is unavailable</h1><p>Identity services are not configured for this environment.</p></section></main>;
  if (embedded) return <ReviewModerationGate />;
  return <ClerkProvider publishableKey={publishableKey}><ReviewModerationGate /></ClerkProvider>;
}

const styles = {
  shell: { padding: 20, background: "#f6f2e8", color: "#173b2a" },
  card: { maxWidth: 860, margin: "24px auto", padding: 28, background: "#fffdf8", border: "1px solid #d6ded6", borderRadius: 16, lineHeight: 1.5 },
  eyebrow: { color: "#6a2f17", fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" },
  note: { color: "#526b5d" }, error: { color: "#a32d20", fontWeight: 700 },
  list: { listStyle: "none", padding: 0, display: "grid", gap: 16 }, item: { borderTop: "1px solid #d9dfd5", paddingTop: 16 },
  appeal: { color: "#7a3a1f" }, actions: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 },
  button: { minHeight: 44, padding: "9px 14px", border: 0, borderRadius: 8, background: "#174d36", color: "#fff", fontWeight: 700, cursor: "pointer" },
  reject: { background: "#6d271f", color: "#fff" },
};
