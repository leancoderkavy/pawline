import { directEndpoint, directError, listConversations, parseListingId, publicConversation, requireConversation } from "./_direct.js";
import { consumeUsage } from "./_usage-limit.js";

export function createConversationsHandler(dependencies) {
  return directEndpoint(["GET", "POST", "PATCH"], async ({ request, response, database, user, notify, environment }) => {
    if (request.method === "GET") {
      const rows = await listConversations(database, user.id);
      return response.status(200).json({ conversations: rows.map(row => publicConversation(row, user.id)), realtime: Boolean(environment.ABLY_API_KEY) });
    }
    if (request.method === "PATCH") {
      const conversation = await requireConversation(database, request.body?.conversationId, user.id);
      const action = request.body?.action;
      if (action === "read") {
        const messageId = parseListingId(request.body?.messageId);
        if (!messageId) throw directError("Choose the last message you read.");
        await database`
          INSERT INTO direct_conversation_state (conversation_id, clerk_user_id, last_read_at)
          SELECT ${conversation.id}, ${user.id}, created_at FROM direct_messages
          WHERE id = ${messageId} AND conversation_id = ${conversation.id} AND moderation_state = 'visible'
          ON CONFLICT (conversation_id, clerk_user_id) DO UPDATE
            SET last_read_at = GREATEST(direct_conversation_state.last_read_at, EXCLUDED.last_read_at)
        `;
      } else if (action === "block" || action === "unblock") {
        await database`
          INSERT INTO direct_conversation_state (conversation_id, clerk_user_id, blocked_at)
          VALUES (${conversation.id}, ${user.id}, ${action === "block" ? new Date().toISOString() : null}::timestamptz)
          ON CONFLICT (conversation_id, clerk_user_id) DO UPDATE SET blocked_at = EXCLUDED.blocked_at
        `;
      } else if (action === "resolve" || action === "reopen") {
        await database`UPDATE direct_conversations SET status = ${action === "resolve" ? "resolved" : "open"} WHERE id = ${conversation.id}`;
      } else throw directError("Choose a valid conversation action.");
      if (action === "block" || action === "resolve") {
        await database`UPDATE direct_video_calls SET state = 'ended', ended_at = now() WHERE conversation_id = ${conversation.id} AND state IN ('ringing', 'accepted')`;
        await database`DELETE FROM direct_video_signals WHERE call_id IN (SELECT id FROM direct_video_calls WHERE conversation_id = ${conversation.id})`;
      }
      const updated = await requireConversation(database, conversation.id, user.id);
      if (action !== "read") await notify(updated);
      return response.status(200).json({ conversation: publicConversation(updated, user.id) });
    }

    const listingId = parseListingId(request.body?.listingId);
    if (!listingId) throw directError("Choose a valid Pawline listing.");
    const listings = await database`
      SELECT p.id, p.shelter, p.organization_id, p.claimed_by_clerk_user_id, p.claimed_by_display_name,
        o.name AS organization_name,
        (SELECT clerk_user_id FROM organization_memberships m WHERE m.organization_id = p.organization_id ORDER BY created_at, clerk_user_id LIMIT 1) AS team_contact,
        EXISTS (SELECT 1 FROM organization_memberships m WHERE m.organization_id = p.organization_id AND m.clerk_user_id = ${user.id}) AS is_member
      FROM pets p LEFT JOIN organizations o ON o.id = p.organization_id
      WHERE p.id = ${listingId} AND p.status = 'available' AND p.verified_at IS NOT NULL LIMIT 1
    `;
    const listing = listings[0];
    const ownerId = listing?.organization_id ? listing.team_contact : listing?.claimed_by_clerk_user_id;
    if (!ownerId) throw directError("This listing is not accepting Pawline messages yet. Contact the organization through its official listing.", 409);
    if (listing.is_member || ownerId === user.id) throw directError("This is your team's listing. Open Messages to answer adoption questions.", 422);
    const allowed = await consumeUsage(database, { scope: "direct_conversation_user_day", subject: user.id, limit: 40, windowMs: 86400000 });
    if (!allowed) throw directError("Conversation limit reached. Try again later.", 429);
    // Serialize first inquiries on this listing, including team-owner changes.
    const results = await database.transaction([
      database`SELECT id FROM pets WHERE id = ${listingId} FOR UPDATE`,
      database`
        INSERT INTO direct_conversations (listing_id, organization_id, owner_clerk_user_id, owner_name, inquirer_clerk_user_id, inquirer_name, inquirer_image_url)
        SELECT ${listing.id}, ${listing.organization_id}, ${ownerId}, ${listing.organization_name || listing.claimed_by_display_name || listing.shelter || "Pawline caretaker"}, ${user.id}, ${user.displayName}, ${user.imageUrl}
        WHERE NOT EXISTS (SELECT 1 FROM direct_conversations WHERE listing_id = ${listingId} AND inquirer_clerk_user_id = ${user.id}
          AND (organization_id = ${listing.organization_id}::uuid OR (organization_id IS NULL AND owner_clerk_user_id = ${ownerId})))
        ON CONFLICT (listing_id, owner_clerk_user_id, inquirer_clerk_user_id) DO NOTHING RETURNING id
      `,
      database`SELECT id FROM direct_conversations WHERE listing_id = ${listingId} AND inquirer_clerk_user_id = ${user.id}
        AND (organization_id = ${listing.organization_id}::uuid OR (organization_id IS NULL AND owner_clerk_user_id = ${ownerId})) ORDER BY created_at LIMIT 1`,
    ]);
    const conversation = await requireConversation(database, results[2][0].id, user.id);
    await notify(conversation);
    return response.status(201).json({ conversation: publicConversation(conversation, user.id) });
  }, dependencies);
}
export default createConversationsHandler();
