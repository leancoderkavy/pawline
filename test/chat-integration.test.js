import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createChatFixture, ids, users } from "../e2e/chat-fixture.mjs";
import { videoConfiguration, validateSignal, purgeExpiredVideoSignals } from "../api/_direct-video.js";

test("shelter messaging: PostgreSQL persistence, team access, pagination, unread, moderation and blocking", async () => {
  const fixture = await createChatFixture();
  const { invoke, database } = fixture;
  try {
    assert.equal((await invoke("direct-conversations", null)).statusCode, 401);
    assert.equal((await invoke("direct-conversations", "adopter", { method: "DELETE" })).statusCode, 405);
    assert.equal((await invoke("direct-conversations", "shelter", { method: "POST", body: { listingId: ids.pet } })).statusCode, 422);
    const opened = await invoke("direct-conversations", "adopter", { method: "POST", body: { listingId: ids.pet } });
    assert.equal(opened.statusCode, 201);
    const conversationId = opened.data.conversation.id;
    assert.equal(opened.data.conversation.organization.name, "Willow Animal Shelter");
    const again = await invoke("direct-conversations", "adopter", { method: "POST", body: { listingId: ids.pet } });
    assert.equal(again.data.conversation.id, conversationId);
    assert.equal((await invoke("direct-conversations", "teammate")).data.conversations[0].role, "listing_contact");
    assert.equal((await invoke("direct-messages", "stranger", { query: { conversationId } })).statusCode, 404);
    const clientMessageId = randomUUID();
    const body = { conversationId, body: "Is Miso comfortable around other cats?", clientMessageId };
    const sent = await invoke("direct-messages", "adopter", { method: "POST", body });
    assert.equal(sent.statusCode, 201);
    assert.equal(sent.data.message.mine, true);
    assert.equal((await invoke("direct-messages", "adopter", { method: "POST", body })).data.message.id, sent.data.message.id);
    let teamInbox = await invoke("direct-conversations", "teammate");
    assert.equal(teamInbox.data.conversations[0].unreadCount, 1);
    const patch = action => invoke("direct-conversations", "teammate", { method: "PATCH", body: { conversationId, action, messageId: sent.data.message.id } });
    await patch("read");
    assert.equal((await invoke("direct-conversations", "teammate")).data.conversations[0].unreadCount, 0);
    const reply = await invoke("direct-messages", "teammate", { method: "POST", body: { conversationId, body: "We can talk through Miso's routine and arrange a video introduction.", clientMessageId: randomUUID() } });
    assert.equal(reply.statusCode, 201);
    assert.equal((await invoke("direct-messages", "adopter", { query: { conversationId } })).data.messages[1].mine, false);
    assert.equal((await invoke("direct-messages", "adopter", { method: "POST", body: { conversationId, body: "wire money to meet the cat", clientMessageId: randomUUID() } })).statusCode, 422);
    assert.equal((await invoke("direct-messages", "adopter", { method: "POST", body: { conversationId, body: "x".repeat(2001), clientMessageId: randomUUID() } })).statusCode, 422);
    const report = await invoke("direct-message-report", "shelter", { method: "POST", body: { messageId: sent.data.message.id } });
    assert.equal(report.statusCode, 202);
    assert.equal((await invoke("direct-message-report", "stranger", { method: "POST", body: { messageId: sent.data.message.id } })).statusCode, 404);
    await patch("resolve");
    assert.equal((await invoke("direct-messages", "adopter", { method: "POST", body })).statusCode, 409);
    await patch("reopen");
    await patch("block");
    assert.equal((await invoke("direct-messages", "adopter", { method: "POST", body })).statusCode, 409);
    await invoke("direct-conversations", "adopter", { method: "PATCH", body: { conversationId, action: "unblock" } });
    assert.equal((await invoke("direct-conversations", "adopter")).data.conversations[0].blocked, true);
    await patch("unblock");
    await database`DELETE FROM organization_memberships WHERE clerk_user_id = ${users.shelter.id}`;
    assert.equal((await invoke("direct-conversations", "shelter")).data.conversations.length, 0, "A former owner loses team access");
    assert.equal((await invoke("direct-messages", "shelter", { query: { conversationId } })).statusCode, 404);
    await database`
      INSERT INTO direct_messages (conversation_id, sender_clerk_user_id, author_name, body, created_at)
      SELECT ${conversationId}, ${users.teammate.id}, 'Sam', 'History ' || i, now() - interval '1 day' + i * interval '1 second' FROM generate_series(1, 170) AS i
    `;
    const newest = (await invoke("direct-messages", "adopter", { query: { conversationId } })).data;
    assert.equal(newest.messages.length, 60);
    assert.equal(newest.messages.at(-1).id, reply.data.message.id, "Latest messages remain visible beyond the old 160-message limit");
    const older = (await invoke("direct-messages", "adopter", { query: { conversationId, before: newest.olderCursor } })).data;
    assert.equal(older.messages.length, 60);
    assert.equal(new Set([...older.messages, ...newest.messages].map(message => message.id)).size, 120);
    // PostgreSQL timestamp precision must survive the UUID cursor round-trip.
    await database`DELETE FROM direct_messages WHERE conversation_id = ${conversationId}`;
    await database`
      INSERT INTO direct_messages (conversation_id, sender_clerk_user_id, author_name, body, created_at)
      SELECT ${conversationId}, ${users.teammate.id}, 'Sam', 'Same moment ' || i, '2026-08-01 12:00:00.123456+00'::timestamptz FROM generate_series(1, 65) AS i
    `;
    const precisePage = (await invoke("direct-messages", "adopter", { query: { conversationId } })).data;
    const preciseOlder = (await invoke("direct-messages", "adopter", { query: { conversationId, before: precisePage.olderCursor } })).data;
    assert.equal(preciseOlder.messages.length, 5, "Messages at the same microsecond are not skipped");
  } finally { await fixture.close(); }
});

test("video calls: consent, exact participant isolation, atomic acceptance, signals, expiry and cleanup", async () => {
  const fixture = await createChatFixture();
  const { invoke, database } = fixture;
  try {
    const conversationId = (await invoke("direct-conversations", "adopter", { method: "POST", body: { listingId: ids.pet } })).data.conversation.id;
    const callId = randomUUID();
    const call = (user, action, extra = {}) => invoke("direct-video", user, { method: "POST", body: { conversationId, callId, action, ...extra } });
    assert.equal((await call("adopter", "start")).statusCode, 201);
    assert.equal((await call("stranger", "accept")).statusCode, 404);
    assert.equal((await call("adopter", "accept")).statusCode, 409);
    assert.equal((await call("shelter", "signal", { signalId: randomUUID(), kind: "offer", payload: { type: "offer", sdp: "v=0\r\n" } })).statusCode, 403);
    assert.equal((await invoke("direct-conversations", "shelter")).data.conversations[0].incomingCall.id, callId);
    const attempts = await Promise.all([call("shelter", "accept"), call("teammate", "accept")]);
    assert.deepEqual(attempts.map(result => result.statusCode).sort(), [200, 409]);
    const winner = attempts[0].statusCode === 200 ? "shelter" : "teammate";
    const loser = winner === "shelter" ? "teammate" : "shelter";
    const signal = { signalId: randomUUID(), kind: "offer", payload: { type: "offer", sdp: "v=0\r\n" } };
    assert.equal((await call("adopter", "signal", signal)).statusCode, 200);
    await call("adopter", "signal", signal);
    const received = (await invoke("direct-video", winner, { query: { conversationId, callId } })).data;
    assert.equal(received.signals.length, 1);
    assert.equal((await invoke("direct-video", loser, { query: { conversationId, callId } })).data.signals.length, 0);
    assert.equal((await call(loser, "end")).statusCode, 403);
    assert.equal((await call("adopter", "end")).data.call.state, "ended");
    assert.equal((await database`SELECT count(*) AS n FROM direct_video_signals`)[0].n, 0);
    assert.equal((await call(winner, "signal", signal)).statusCode, 403);
    const otherCall = randomUUID();
    await call("adopter", "start", { callId: otherCall });
    await database`UPDATE direct_video_calls SET expires_at = now() - interval '1 second' WHERE id = ${otherCall}`;
    assert.equal((await invoke("direct-video", "shelter", { query: { conversationId, callId: otherCall } })).data.call.state, "missed");
    const abandonedCall = randomUUID();
    await call("adopter", "start", { callId: abandonedCall });
    await call("teammate", "accept", { callId: abandonedCall });
    await call("adopter", "signal", { ...signal, signalId: randomUUID(), callId: abandonedCall });
    await database`DELETE FROM organization_memberships WHERE clerk_user_id = ${users.teammate.id}`;
    assert.equal((await invoke("direct-video", "teammate", { query: { conversationId, callId: abandonedCall } })).statusCode, 404);
    await database`UPDATE direct_video_calls SET caller_seen_at = now() - interval '1 minute' WHERE id = ${abandonedCall}`;
    assert.equal(await purgeExpiredVideoSignals(database), 1);
    assert.equal((await database`SELECT state FROM direct_video_calls WHERE id = ${abandonedCall}`)[0].state, "ended");
  } finally { await fixture.close(); }
});

test("production video requires TURN and issues temporary credentials without exposing the secret", () => {
  assert.equal(videoConfiguration({ NODE_ENV: "production", PAWLINE_VIDEO_ENABLED: "true", PAWLINE_VIDEO_ALLOW_DIRECT: "true" }).enabled, false);
  const config = videoConfiguration({ NODE_ENV: "production", PAWLINE_VIDEO_ENABLED: "true", PAWLINE_TURN_URLS: "turns:relay.example.org:5349?transport=tcp", PAWLINE_TURN_SHARED_SECRET: "fixture-secret" }, "private-user", "call");
  assert.equal(config.enabled, true);
  assert.equal(config.iceTransportPolicy, "relay");
  assert.doesNotMatch(JSON.stringify(config), /fixture-secret|private-user/);
  assert.throws(() => validateSignal("offer", { type: "answer", sdp: "v=0" }));
  assert.throws(() => validateSignal("candidate", { candidate: "a".repeat(5000) }));
});
