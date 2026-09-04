import React from "react";
import { SHELTER_NEXT_STATUSES, SHELTER_STATUS_LABELS as STATUS_LABELS } from "./shelterWorkflow.js";

function WorkspaceCard({ title, children }) {
  return <section style={styles.card} aria-label={title}><h2 style={styles.heading}>{title}</h2>{children}</section>;
}

export default function ShelterWorkspace({
  organization, applications = [], selectedApplicationId, onSelectApplication, onUpdateCapacity,
  onSaveHours, onRequestSummary, onUpdateStatus, onSendMessage, onConfirmOutcome, summary, summaryState = "idle",
  reviews = [], onReplyToReview, onAppealReview,
}) {
  if (!organization) return <main style={styles.shell}><p>Your shelter workspace is not available yet.</p></main>;
  const selected = applications.find((application) => application.id === selectedApplicationId) || applications[0];
  const capacity = organization.intakeCapacity || "accepting";
  const isAdministrator = organization.role === "administrator";
  return (
    <main style={styles.shell} aria-labelledby="shelter-workspace-title">
      <header style={styles.header}>
        <div><p style={styles.eyebrow}>Shelter workspace</p><h1 id="shelter-workspace-title" style={styles.title}>{organization.name}</h1>
          <p style={styles.muted}>Public information is {organization.verificationState?.replace(/_/g, " ") || "unclaimed"}. Keep hours and intake status current.</p></div>
        <label style={styles.label}>Intake status
          <select value={capacity} disabled={!isAdministrator} onChange={(event) => onUpdateCapacity?.(event.target.value)} style={styles.select}>
            <option value="accepting">Accepting</option><option value="limited">Limited</option>
            <option value="waitlist">Waitlist</option><option value="paused">Paused</option>
          </select>
        </label>
      </header>
      <div style={styles.grid}>
        <WorkspaceCard title="Adoption questions">
          <p style={styles.muted}>Answer questions about your listed pets with your team, and arrange a private video introduction.</p>
          <a href="#messages" className="button">Open shelter inbox</a>
        </WorkspaceCard>
        <WorkspaceCard title={`Applications (${applications.length})`}>
          {applications.length ? <ul style={styles.list}>
            {applications.map((application) => <li key={application.id} style={styles.listItem}>
              <button type="button" style={application.id === selected?.id ? styles.activeButton : styles.button}
                onClick={() => onSelectApplication?.(application.id)}>
                <span>{application.petName || "Application"}</span><small>{STATUS_LABELS[application.status] || application.status}</small>
              </button>
            </li>)}
          </ul> : <p style={styles.muted}>New applications will appear here when your intake is enabled.</p>}
        </WorkspaceCard>
        <WorkspaceCard title="Public visit hours">
          {organization.locationId ? <HoursEditor hours={organization.hours} onSave={onSaveHours} disabled={!isAdministrator} /> : <p style={styles.muted}>Add a location before publishing regular visit hours.</p>}
          {!isAdministrator ? <p style={styles.muted}>Only an organization administrator can change public settings.</p> : null}
        </WorkspaceCard>
        <WorkspaceCard title="Application review">
          {selected ? <>
            <p style={styles.muted}>Review original answers before taking any action.</p>
            <dl style={styles.facts}>{Object.entries(selected.sharedAnswers || {}).slice(0, 6).map(([key, value]) =>
              <React.Fragment key={key}><dt>{key.replace(/_/g, " ")}</dt><dd>{String(value)}</dd></React.Fragment>)}</dl>
            <button type="button" style={styles.primaryButton} disabled={summaryState === "loading"}
              onClick={() => onRequestSummary?.(selected.id)}>
              {summaryState === "loading" ? "Preparing summary…" : "Create factual AI summary"}
            </button>
            <ApplicationActions application={selected} onUpdateStatus={onUpdateStatus} onSendMessage={onSendMessage} onConfirmOutcome={onConfirmOutcome} />
          </> : <p style={styles.muted}>Select an application to review it.</p>}
        </WorkspaceCard>
        <WorkspaceCard title="AI-assisted summary">
          {summary ? <>
            <p style={styles.disclosure}>AI-assisted factual summary. It does not score applicants or recommend a decision.</p>
            <ul style={styles.summaryList}>{summary.factualSummary?.map((item) => <li key={`${item.fields?.join("-")}-${item.text}`}><strong>{item.fields?.join(", ").replace(/([A-Z])/g, " $1")}:</strong> {item.text}</li>)}</ul>
            {summary.followUpQuestions?.length ? <><h3 style={styles.subheading}>Questions to consider</h3><ul style={styles.summaryList}>{summary.followUpQuestions.map((item) => <li key={`${item.fields?.join("-")}-${item.text}`}>{item.text}</li>)}</ul></> : null}
          </> : <p style={styles.muted}>This optional tool uses only consented, relevant application fields and always leaves the original application available.</p>}
        </WorkspaceCard>
        <WorkspaceCard title="Verified reviews">
          {isAdministrator ? <OrganizationReviews reviews={reviews} onReply={onReplyToReview} onAppeal={onAppealReview} /> : <p style={styles.muted}>Only organization administrators can manage review replies and appeals.</p>}
        </WorkspaceCard>
      </div>
    </main>
  );
}

function HoursEditor({ hours = [], onSave, disabled = false }) {
  const initial = Object.fromEntries(hours.map((entry) => [entry.weekday, entry]));
  const [entries, setEntries] = React.useState(() => Array.from({ length: 7 }, (_, weekday) => ({
    weekday, isClosed: initial[weekday]?.isClosed || false, opensAt: initial[weekday]?.opensAt || "09:00", closesAt: initial[weekday]?.closesAt || "17:00",
  })));
  const update = (weekday, patch) => setEntries((current) => current.map((entry) => entry.weekday === weekday ? { ...entry, ...patch } : entry));
  return <form onSubmit={(event) => { event.preventDefault(); onSave?.(entries); }} style={styles.hoursForm}>
    {entries.map((entry) => <div key={entry.weekday} style={styles.hourRow}>
      <label style={styles.weekday}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][entry.weekday]}</label>
      <label style={styles.closed}><input type="checkbox" disabled={disabled} checked={entry.isClosed} onChange={(event) => update(entry.weekday, { isClosed: event.target.checked })} /> Closed</label>
      <input aria-label={`${entry.weekday} opening time`} type="time" value={entry.opensAt} disabled={disabled || entry.isClosed} onChange={(event) => update(entry.weekday, { opensAt: event.target.value })} style={styles.timeInput} />
      <span aria-hidden="true">to</span>
      <input aria-label={`${entry.weekday} closing time`} type="time" value={entry.closesAt} disabled={disabled || entry.isClosed} onChange={(event) => update(entry.weekday, { closesAt: event.target.value })} style={styles.timeInput} />
    </div>)}
    <button type="submit" disabled={disabled} style={styles.primaryButton}>Save confirmed hours</button>
  </form>;
}

function ApplicationActions({ application, onUpdateStatus, onSendMessage, onConfirmOutcome }) {
  const [message, setMessage] = React.useState("");
  const send = () => { if (message.trim()) { onSendMessage?.(application.id, message); setMessage(""); } };
  return <div style={styles.actions}>
    <label style={styles.label}>Update milestone
      <select value={application.status} onChange={(event) => onUpdateStatus?.(application.id, event.target.value)} style={styles.select}>
        <option value={application.status}>{STATUS_LABELS[application.status] || application.status}</option>
        {(SHELTER_NEXT_STATUSES[application.status] || []).map((status) => <option key={status} value={status}>{STATUS_LABELS[status] || status}</option>)}
      </select>
    </label>
    <label style={styles.label}>Follow up
      <textarea value={message} maxLength="4000" onChange={(event) => setMessage(event.target.value)} style={styles.textarea} placeholder="Write a respectful follow-up…" />
    </label>
    <button type="button" style={styles.button} onClick={send} disabled={!message.trim()}>Send message</button>
    {application.status === "adoption_pending" ? <div style={styles.outcomeRow}><span>Confirm outcome:</span>
      <button type="button" style={styles.button} onClick={() => onConfirmOutcome?.(application.id, "adopted")}>Adopted</button>
      <button type="button" style={styles.button} onClick={() => onConfirmOutcome?.(application.id, "not_adopted")}>Not adopted</button>
    </div> : null}
  </div>;
}

function OrganizationReviews({ reviews, onReply, onAppeal }) {
  const [drafts, setDrafts] = React.useState({});
  if (!reviews.length) return <p style={styles.muted}>No verified-review records are awaiting an organization response.</p>;
  return <div style={styles.reviewList}>{reviews.map((review) => {
    const draft = drafts[review.id] || { reply: "", appeal: "" };
    const update = (patch) => setDrafts((current) => ({ ...current, [review.id]: { ...draft, ...patch } }));
    return <article key={review.id} style={styles.reviewItem}>
      <strong>{review.rating}/5 · {review.moderationState?.replace(/_/g, " ") || "pending"}</strong>
      <p style={styles.muted}>{review.narrative || "No public narrative was provided."}</p>
      {review.appeal ? <p style={styles.disclosure}>Appeal {review.appeal.status}: awaiting Pawline moderation.</p> : null}
      {review.reply ? <p style={styles.disclosure}>Organization reply: {review.reply.body}</p> : null}
      {review.moderationState === "published" && !review.reply ? <label style={styles.label}>Public reply
        <textarea value={draft.reply} maxLength="2000" onChange={(event) => update({ reply: event.target.value })} style={styles.textarea} />
        <button type="button" style={styles.button} disabled={!draft.reply.trim()} onClick={() => onReply?.(review.id, draft.reply)}>Publish reply</button>
      </label> : null}
      {review.moderationState === "published" && !review.appeal ? <label style={styles.label}>Appeal to Pawline
        <textarea value={draft.appeal} maxLength="1200" onChange={(event) => update({ appeal: event.target.value })} style={styles.textarea} />
        <button type="button" style={styles.button} disabled={!draft.appeal.trim()} onClick={() => onAppeal?.(review.id, draft.appeal)}>Submit appeal</button>
      </label> : null}
    </article>;
  })}</div>;
}

const styles = {
  shell: { maxWidth: 1180, margin: "0 auto", padding: "24px 16px 48px", color: "#173b2a" },
  header: { display: "flex", justifyContent: "space-between", gap: 24, alignItems: "start", flexWrap: "wrap", marginBottom: 24 },
  eyebrow: { margin: 0, color: "#a8522d", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", fontSize: 12 },
  title: { margin: "4px 0", fontSize: "clamp(1.7rem, 4vw, 2.5rem)" }, heading: { fontSize: "1.05rem", margin: "0 0 14px" },
  subheading: { fontSize: ".95rem", margin: "16px 0 8px" }, muted: { color: "#526b5d", lineHeight: 1.5 },
  label: { display: "grid", gap: 6, fontWeight: 700 }, select: { minHeight: 44, padding: "8px 10px", borderRadius: 8, border: "1px solid #98ab9e", background: "#fff" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 16 },
  card: { background: "#fffdf8", border: "1px solid #d9dfd5", borderRadius: 14, padding: 18, minWidth: 0 },
  list: { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }, listItem: { margin: 0 },
  button: { width: "100%", minHeight: 48, textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #c7d2c9", borderRadius: 8, background: "#fff", color: "inherit", cursor: "pointer" },
  activeButton: { width: "100%", minHeight: 48, textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", border: "2px solid #2d6a4f", borderRadius: 8, background: "#eaf5ec", color: "inherit", cursor: "pointer" },
  primaryButton: { minHeight: 44, padding: "9px 13px", border: 0, borderRadius: 8, background: "#174d36", color: "white", fontWeight: 700, cursor: "pointer" },
  hoursForm: { display: "grid", gap: 8 }, hourRow: { display: "grid", gridTemplateColumns: "40px minmax(70px, auto) minmax(0, 1fr) auto minmax(0, 1fr)", gap: 6, alignItems: "center", fontSize: ".85rem" }, weekday: { fontWeight: 700 }, closed: { whiteSpace: "nowrap" }, timeInput: { minWidth: 0, minHeight: 36 },
  actions: { display: "grid", gap: 10, marginTop: 18, paddingTop: 16, borderTop: "1px solid #d9dfd5" }, textarea: { minHeight: 84, padding: 8, borderRadius: 8, border: "1px solid #98ab9e", font: "inherit" }, outcomeRow: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: ".9rem" },
  facts: { display: "grid", gridTemplateColumns: "minmax(90px, .7fr) minmax(0, 1.3fr)", gap: "8px 12px", margin: "12px 0 16px" },
  disclosure: { color: "#526b5d", fontSize: ".88rem", lineHeight: 1.45 }, summaryList: { paddingLeft: 20, margin: 0, display: "grid", gap: 8, lineHeight: 1.45 },
  reviewList: { display: "grid", gap: 12 }, reviewItem: { borderTop: "1px solid #d9dfd5", paddingTop: 12 },
};
