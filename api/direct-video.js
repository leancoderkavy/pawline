import { directEndpoint, directError, parseConversationId, requireConversation, requireWritable } from "./_direct.js";
import { expireCalls, publicCall, validateSignal, videoConfiguration } from "./_direct-video.js";
import { consumeUsage } from "./_usage-limit.js";

export function createVideoHandler(dependencies) {
  return directEndpoint(["GET", "POST"], async ({ request, response, database, user, notify, environment }) => {
    const input = request.method === "GET" ? request.query : request.body;
    const conversation = await requireConversation(database, input?.conversationId, user.id);
    await expireCalls(database, conversation.id);
    const config = videoConfiguration(environment, user.id, input?.callId || conversation.id);
    if (request.method === "GET" && !input?.callId) {
      const calls = await database`SELECT * FROM direct_video_calls WHERE conversation_id = ${conversation.id} ORDER BY created_at DESC LIMIT 10`;
      return response.status(200).json({ enabled: config.enabled, reason: config.reason, calls: calls.map(call => publicCall(call, user.id, conversation)) });
    }
    const action = input?.action;
    if (request.method === "POST" && action === "start") {
      requireWritable(conversation);
      if (!config.enabled) throw directError(config.reason, 503);
      const allowed = await consumeUsage(database, { scope: "direct_video_start", subject: user.id, limit: 15, windowMs: 3600000 });
      if (!allowed) throw directError("Call limit reached. Please continue in messages for now.", 429);
      const callId = parseConversationId(input.callId);
      if (!callId) throw directError("A valid call request ID is required.");
      const rows = await database`
        INSERT INTO direct_video_calls (id, conversation_id, caller_user_id, caller_name, caller_is_inquirer)
        VALUES (${callId}, ${conversation.id}, ${user.id}, ${user.displayName}, ${conversation.inquirer_clerk_user_id === user.id})
        ON CONFLICT DO NOTHING RETURNING *
      `;
      let call = rows[0];
      if (!call) {
        [call] = await database`SELECT * FROM direct_video_calls WHERE id = ${callId} AND conversation_id = ${conversation.id} AND caller_user_id = ${user.id} AND state = 'ringing'`;
      }
      if (!call) throw directError("A call is already in progress. Open the current invitation or try again when it ends.", 409);
      await notify(conversation);
      return response.status(201).json({ call: publicCall(call, user.id, conversation), configuration: config });
    }
    const callId = parseConversationId(input?.callId);
    if (!callId) throw directError("Choose a valid call.");
    let [call] = await database`SELECT * FROM direct_video_calls WHERE id = ${callId} AND conversation_id = ${conversation.id}`;
    if (!call) throw directError("That call is not available.", 404);
    const view = publicCall(call, user.id, conversation);
    const live = ["ringing", "accepted"].includes(call.state);
    if (request.method === "GET") {
      const after = String(input.after || "0");
      if (!/^\d{1,18}$/.test(after)) throw directError("Invalid signal cursor.");
      // Other team members can see call status, but only the two participants
      // can read descriptions and connection candidates.
      const signals = view.participant && call.state === "accepted" ? await database`
        SELECT id::text, kind, payload FROM direct_video_signals WHERE call_id = ${callId}
          AND sender_user_id <> ${user.id} AND id > ${after}::bigint ORDER BY id LIMIT 100
      ` : [];
      return response.status(200).json({ call: view, signals, configuration: view.participant && live ? config : undefined });
    }
    if (action === "accept" || action === "decline") {
      requireWritable(conversation);
      if (action === "accept" && !config.enabled) throw directError(config.reason, 503);
      if (!view.canAccept) throw directError("This invitation is no longer available to answer.", 409);
      const rows = await database`
        UPDATE direct_video_calls SET state = ${action === "accept" ? "accepted" : "declined"}, callee_user_id = ${user.id},
          callee_seen_at = now(), accepted_at = CASE WHEN ${action} = 'accept' THEN now() ELSE NULL END,
          ended_at = CASE WHEN ${action} = 'decline' THEN now() ELSE NULL END,
          expires_at = CASE WHEN ${action} = 'accept' THEN now() + interval '1 hour' ELSE expires_at END
        WHERE id = ${callId} AND state = 'ringing' AND expires_at > now() RETURNING *
      `;
      if (!rows[0]) throw directError("Someone already answered this invitation, or it expired.", 409);
      call = rows[0];
    } else if (action === "end") {
      if (!view.participant) throw directError("Only call participants can end this call.", 403);
      [call] = await database`
        UPDATE direct_video_calls SET state = CASE WHEN state = 'ringing' THEN 'cancelled' WHEN state = 'accepted' THEN 'ended' ELSE state END,
          ended_at = COALESCE(ended_at, now()) WHERE id = ${callId} RETURNING *
      `;
      await database`DELETE FROM direct_video_signals WHERE call_id = ${callId}`;
    } else if (action === "heartbeat") {
      if (!view.participant || !live) throw directError("This call has ended.", 409);
      requireWritable(conversation);
      await database`
        UPDATE direct_video_calls SET
          caller_seen_at = CASE WHEN caller_user_id = ${user.id} THEN now() ELSE caller_seen_at END,
          callee_seen_at = CASE WHEN callee_user_id = ${user.id} THEN now() ELSE callee_seen_at END
        WHERE id = ${callId} AND state IN ('ringing', 'accepted')
      `;
    } else if (action === "signal") {
      requireWritable(conversation);
      if (!view.participant || call.state !== "accepted") throw directError("Join this call before connecting media.", 403);
      const signalId = parseConversationId(input.signalId);
      if (!signalId) throw directError("A valid signal request ID is required.");
      if ((input.kind === "offer" && !view.mine) || (input.kind === "answer" && view.mine)) throw directError("Invalid negotiation role.", 403);
      const payload = validateSignal(input.kind, input.payload);
      const allowed = await consumeUsage(database, { scope: "direct_video_signal", subject: `${callId}:${user.id}`, limit: 240, windowMs: 3600000 });
      if (!allowed) throw directError("Connection retry limit reached. End this call and try again.", 429);
      await database`
        INSERT INTO direct_video_signals (call_id, sender_user_id, client_signal_id, kind, payload)
        VALUES (${callId}, ${user.id}, ${signalId}, ${input.kind}, ${JSON.stringify(payload)}::jsonb)
        ON CONFLICT (call_id, sender_user_id, client_signal_id) DO NOTHING
      `;
    } else throw directError("Choose a valid call action.");
    if (["accept", "decline", "end"].includes(action)) await notify(conversation);
    return response.status(200).json({ call: publicCall(call, user.id, conversation), configuration: config.enabled && ["accept"].includes(action) ? config : undefined });
  }, dependencies);
}
export default createVideoHandler();
