import { safeImageUrl } from "./_safe-url.js";
import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import Ably from "ably";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseListingId(value) {
  const raw = String(value || "");
  const id = raw.startsWith("pawline-") ? raw.slice("pawline-".length) : raw;
  return UUID_PATTERN.test(id) ? id : null;
}

export function parseConversationId(value) {
  const id = String(value || "");
  return UUID_PATTERN.test(id) ? id : null;
}

export function publicConversation(row, userId) {
  const isOwner = row.inquirer_clerk_user_id !== userId;
  return {
    id: row.id,
    role: isOwner ? "listing_contact" : "inquirer",
    other: {
      name: isOwner ? row.inquirer_name : row.organization_name || row.owner_name,
      imageUrl: safeImageUrl(isOwner ? row.inquirer_image_url : row.owner_image_url),
    },
    listing: {
      id: `pawline-${row.listing_id}`,
      name: row.pet_name,
      shelter: row.shelter,
      species: row.species,
      breed: row.breed,
      image: safeImageUrl(row.image_url),
      city: row.city,
    },
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    organization: row.organization_id ? { id: row.organization_id, name: row.organization_name || row.shelter } : null,
    status: row.status || "open",
    unreadCount: Number(row.unread_count || 0),
    preview: row.preview || "Ask your first question",
    blocked: Boolean(row.blocked),
    blockedByMe: Boolean(row.blocked_by_me),
    incomingCall: row.incoming_call || null,
    lastCall: row.last_call || null,
  };
}

export function publicDirectMessage(row, userId) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    body: row.body,
    mine: row.sender_clerk_user_id === userId,
    author: {
      id: row.sender_clerk_user_id,
      name: row.author_name,
      imageUrl: safeImageUrl(row.author_image_url),
    },
    createdAt: row.created_at,
    reportCount: Number(row.report_count || 0),
  };
}

export async function ensureDirectMessageTables(database) {
  const schema = await database`
    SELECT
      to_regclass('public.direct_conversations') AS conversations,
      to_regclass('public.direct_messages') AS messages,
      to_regclass('public.direct_message_reports') AS reports,
      to_regclass('public.direct_conversation_state') AS state,
      to_regclass('public.direct_video_calls') AS calls,
      to_regclass('public.direct_video_signals') AS signals
  `;
  if (!schema[0]?.conversations || Object.values(schema[0]).some(value => !value)) {
    throw new Error("Direct messaging migration is missing.");
  }
}

export async function listConversations(database, userId, conversationId = null) {
  const rows = await database`
    SELECT c.*, p.name AS pet_name, p.species, p.breed, p.shelter, p.image_url, p.city,
      o.name AS organization_name,
      (SELECT json_build_object('state', v.state, 'createdAt', v.created_at) FROM direct_video_calls v
        WHERE v.conversation_id = c.id ORDER BY v.created_at DESC LIMIT 1) AS last_call,
      (SELECT json_build_object('id', v.id, 'conversationId', c.id, 'callerName', v.caller_name, 'state', v.state, 'canAccept', true, 'mine', false, 'participant', false)
        FROM direct_video_calls v WHERE v.conversation_id = c.id AND v.state = 'ringing' AND v.expires_at > now()
          AND v.caller_seen_at > now() - interval '45 seconds'
          AND v.caller_is_inquirer <> (c.inquirer_clerk_user_id = ${userId}) LIMIT 1) AS incoming_call,
      EXISTS (SELECT 1 FROM direct_conversation_state s WHERE s.conversation_id = c.id AND s.blocked_at IS NOT NULL) AS blocked,
      EXISTS (SELECT 1 FROM direct_conversation_state s WHERE s.conversation_id = c.id AND s.clerk_user_id = ${userId} AND s.blocked_at IS NOT NULL) AS blocked_by_me,
      (SELECT count(*) FROM direct_messages m WHERE m.conversation_id = c.id AND m.moderation_state = 'visible'
        AND m.sender_clerk_user_id <> ${userId} AND m.created_at > COALESCE(
          (SELECT last_read_at FROM direct_conversation_state s WHERE s.conversation_id = c.id AND s.clerk_user_id = ${userId}), '-infinity'::timestamptz)) AS unread_count,
      (SELECT body FROM direct_messages m WHERE m.conversation_id = c.id AND m.moderation_state = 'visible' ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS preview
    FROM direct_conversations c
    JOIN pets p ON p.id = c.listing_id
    LEFT JOIN organizations o ON o.id = c.organization_id
    WHERE (${conversationId}::uuid IS NULL OR c.id = ${conversationId}::uuid)
      AND (c.inquirer_clerk_user_id = ${userId}
        OR (c.organization_id IS NULL AND c.owner_clerk_user_id = ${userId})
        OR EXISTS (SELECT 1 FROM organization_memberships membership
          WHERE membership.organization_id = c.organization_id AND membership.clerk_user_id = ${userId}))
    ORDER BY c.last_message_at DESC, c.id DESC
    LIMIT 200
  `;
  return rows;
}

export async function findConversation(database, conversationId, userId) {
  const rows = await listConversations(database, userId, conversationId);
  return rows[0] || null;
}

export function directError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

export async function requireConversation(database, id, userId) {
  if (!parseConversationId(id)) throw directError("Choose a valid conversation.");
  const conversation = await findConversation(database, id, userId);
  if (!conversation) throw directError("That conversation is not available to this account.", 404);
  return conversation;
}

export function requireWritable(conversation) {
  if (conversation.blocked) throw directError("Messaging and calls are paused because this conversation is blocked.", 409);
  if (conversation.status === "resolved") throw directError("This question is resolved. Reopen the conversation to reply or call.", 409);
}

// Publish invalidations only. Every client rechecks current membership over HTTP;
// an old realtime token must never reveal message content after membership removal.
export async function publishDirectEvent(database, conversation) {
  if (!process.env.ABLY_API_KEY) return;
  const members = conversation.organization_id ? await database`
    SELECT clerk_user_id FROM organization_memberships WHERE organization_id = ${conversation.organization_id}
  ` : [{ clerk_user_id: conversation.owner_clerk_user_id }];
  const recipients = new Set([conversation.inquirer_clerk_user_id, ...members.map(row => row.clerk_user_id)]);
  const ably = new Ably.Rest({ key: process.env.ABLY_API_KEY, httpRequestTimeout: 3000, httpMaxRetryCount: 0 });
  await Promise.all([...recipients].map(id => ably.channels.get(`pawline:direct:${id}`).publish("conversation.updated", { conversationId: conversation.id })));
}

export function directEndpoint(methods, action, dependencies = {}) {
  const databaseForRequest = dependencies.getDatabase || getDatabase;
  const authenticate = dependencies.authenticate || requireUser;
  const publish = dependencies.publish || publishDirectEvent;
  return async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (!methods.includes(request.method)) {
      response.setHeader("Allow", methods.join(", "));
      return response.status(405).json({ error: "Method not allowed" });
    }
    try {
      const user = await authenticate(request);
      const database = databaseForRequest();
      if (!database) throw directError("Private messages are temporarily unavailable.", 503);
      await ensureDirectMessageTables(database);
      const notify = conversation => publish(database, conversation).catch(() => {});
      return await action({ request, response, database, user, notify, environment: dependencies.environment || process.env });
    } catch (error) {
      dependencies.onError?.(error);
      return response.status(error.statusCode || 503).json({ error: error.statusCode ? error.message : "Chat is temporarily unavailable. Please try again." });
    }
  };
}
