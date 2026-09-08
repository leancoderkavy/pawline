"use client";
import React, { useEffect, useState } from "react";
import "./networkTools.css";
export default function MeetingPlanner({ conversationId, request, disabled }) {
  const [meetings, setMeetings] = useState([]),
    [startsAt, setStartsAt] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  useEffect(() => {
    let active = true;
    const load = () =>
      request(`/api/direct-meetings?conversationId=${conversationId}`)
        .then((r) => {
          if (active) setMeetings(r.meetings || []);
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [conversationId, request]);
  async function update(method, body) {
    setBusy(true);
    setNotice("");
    try {
      await request("/api/direct-meetings", {
        method,
        body: JSON.stringify({ conversationId, ...body }),
      });
      const result = await request(
        `/api/direct-meetings?conversationId=${conversationId}`,
      );
      setMeetings(result.meetings);
      setNotice("Meeting updated. Both participants can see it here.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="meeting-planner">
      <summary>
        Arrange a meet-and-greet
        {meetings.filter((m) => m.state !== "cancelled").length
          ? ` (${meetings.filter((m) => m.state !== "cancelled").length})`
          : ""}
      </summary>
      <p>
        Times are shown in {timezone}. Confirm the meeting here, then use the
        conversation to agree on video or an in-person visit.
      </p>
      {notice ? <p role="status">{notice}</p> : null}
      <ul>
        {meetings.map((m) => (
          <li key={m.id}>
            {new Date(m.starts_at).toLocaleString()} · {m.state}
            {m.state !== "cancelled" ? (
              <>
                {!m.mine && m.state === "proposed" ? (
                  <button
                    disabled={busy || disabled}
                    onClick={() =>
                      update("PATCH", { id: m.id, state: "confirmed" })
                    }
                  >
                    Confirm
                  </button>
                ) : null}
                <button
                  disabled={busy || disabled}
                  onClick={() =>
                    update("PATCH", { id: m.id, state: "cancelled" })
                  }
                >
                  Cancel meeting
                </button>
              </>
            ) : null}
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update("POST", {
            startsAt: new Date(startsAt).toISOString(),
            timezone,
          });
        }}
      >
        <label>
          Propose a time ({timezone})
          <input
            required
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </label>
        <button disabled={busy || disabled || !startsAt}>
          Propose meeting
        </button>
      </form>
    </details>
  );
}
