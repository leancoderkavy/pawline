import { NextResponse } from "next/server";
import { getDatabase } from "../../../api/_db.js";
import { normalizeResendDeliveryEvent, verifyResendSignature } from "../../../api/_resend-webhook.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const raw = await request.text();
  const deliveryId = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!verifyResendSignature({
    payload: raw, id: deliveryId, timestamp, signature, secret: process.env.RESEND_WEBHOOK_SECRET,
  })) return new NextResponse("Invalid webhook", { status: 400 });
  let event;
  try { event = JSON.parse(raw); } catch { return new NextResponse("Invalid webhook", { status: 400 }); }
  const normalized = normalizeResendDeliveryEvent(event);
  if (!normalized) return NextResponse.json({ received: true });
  const database = getDatabase();
  if (!database) return new NextResponse("Webhook storage unavailable", { status: 503 });
  try {
    const inserted = await database`
      INSERT INTO organization_email_events (outreach_message_id, provider_event_id, event_type, metadata)
      SELECT id, ${deliveryId}, ${normalized.eventType}, ${JSON.stringify({ source: "resend" })}
      FROM organization_outreach_messages WHERE resend_email_id = ${normalized.emailId}
      ON CONFLICT (provider_event_id) DO NOTHING
      RETURNING outreach_message_id
    `;
    if (!inserted[0]) return NextResponse.json({ received: true });
    const messageRows = await database`
      SELECT id, recipient_email FROM organization_outreach_messages WHERE id = ${inserted[0].outreach_message_id} LIMIT 1
    `;
    const message = messageRows[0];
    if (!message) return NextResponse.json({ received: true });
    if (["bounced", "complained"].includes(normalized.eventType)) {
      await database.transaction([
        database`
          UPDATE organization_outreach_messages SET status = ${normalized.eventType}, updated_at = now()
          WHERE id = ${message.id}
        `,
        database`
          INSERT INTO organization_email_suppressions (email, reason)
          VALUES (${message.recipient_email}, ${normalized.eventType === "bounced" ? "bounce" : "complaint"})
          ON CONFLICT (email) DO NOTHING
        `,
      ]);
    } else {
      await database`
        UPDATE organization_outreach_messages SET
          status = CASE
            WHEN status IN ('bounced', 'complained', 'opted_out') THEN status
            WHEN status = 'delivered' AND ${normalized.eventType} = 'sent' THEN status
            ELSE ${normalized.eventType}
          END,
          updated_at = now()
        WHERE id = ${message.id}
      `;
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Resend webhook storage failed", error.message);
    return new NextResponse("Webhook storage unavailable", { status: 503 });
  }
}
