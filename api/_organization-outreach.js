import {
  adoptionError, canSendToRecipient, claimUrl, createClaimToken, hashClaimToken, safeEmail,
} from "./_adoption-platform.js";

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && url.hostname && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

// Canonical organization records are never inferred from a legacy shelter
// string. This only determines whether an already-linked, unclaimed record has
// enough public evidence to create a reviewed, unsent claim outbox entry.
export function heldInvitationEligibility(organization) {
  if (!organization?.id) return { state: "manual_contact_required" };
  if (organization.verification_state !== "unclaimed") return { state: "manual_contact_required" };
  const recipient = safeEmail(organization.public_contact_email);
  const domain = String(organization.official_domain || "").trim().toLowerCase();
  const evidenceUrl = safeHttpsUrl(organization.official_url);
  if (!recipient || !domain || recipient.split("@")[1] !== domain || !evidenceUrl) {
    return { state: "manual_contact_required" };
  }
  return { state: "invite_eligible", recipientEmail: recipient, evidenceUrl };
}

function officialRecipient(email, domain) {
  const recipient = safeEmail(email);
  const normalizedDomain = String(domain || "").trim().toLowerCase();
  if (!recipient || !normalizedDomain || recipient.split("@")[1] !== normalizedDomain) {
    throw adoptionError("A claim invitation needs a documented organization-domain address.", 422);
  }
  return recipient;
}

// Outbox-only. A separately authorized sender may use this record after the
// verified Resend domain, legal copy, and delivery webhook are configured.
export async function queueClaimInvitation(database, organization, { recipientEmail, evidenceUrl }, environment = process.env) {
  const recipient = officialRecipient(recipientEmail, organization?.official_domain);
  if (!/^https:\/\//.test(String(evidenceUrl || ""))) {
    throw adoptionError("Claim outreach needs an official public contact source URL.", 422);
  }
  await canSendToRecipient(database, recipient);
  const token = createClaimToken();
  const tokenHash = hashClaimToken(token);
  const idempotencyKey = `organization-claim/${organization.id}/${tokenHash.slice(0, 24)}`;
  const created = await database`
    WITH outbox AS (
      INSERT INTO organization_outreach_messages (
        organization_id, recipient_email, kind, freshness_cycle, idempotency_key, status
      ) VALUES (${organization.id}, ${recipient}, 'claim_invitation', 'initial', ${idempotencyKey}, 'queued')
      ON CONFLICT (organization_id, recipient_email, kind, freshness_cycle) DO NOTHING
      RETURNING id
    ), token AS (
      INSERT INTO organization_claim_tokens (organization_id, recipient_email, token_hash, expires_at)
      SELECT ${organization.id}, ${recipient}, ${tokenHash}, now() + interval '7 days' FROM outbox
      RETURNING id
    ) SELECT id FROM outbox
  `;
  if (!created[0]) throw adoptionError("A claim invitation is already queued for this official address.", 409);
  return {
    recipient,
    idempotencyKey,
    claimUrl: claimUrl(token, environment),
    // An internal sender must render the evidence URL; no applicant data belongs in this email.
    evidenceUrl,
  };
}

async function queueClaimInvitationNeed(database, organization, eligibility) {
  const recipient = await canSendToRecipient(database, eligibility.recipientEmail);
  const idempotencyKey = `organization-claim-needed/${hashClaimToken(`${organization.id}:${recipient}:initial`)}`;
  const created = await database`
    INSERT INTO organization_outreach_messages (
      organization_id, recipient_email, kind, freshness_cycle, idempotency_key, status
    ) VALUES (${organization.id}, ${recipient}, 'claim_invitation', 'initial', ${idempotencyKey}, 'queued')
    ON CONFLICT (organization_id, recipient_email, kind, freshness_cycle) DO NOTHING
    RETURNING id
  `;
  return Boolean(created[0]);
}

export async function queueHeldApplicationInvitation(database, organization, environment = process.env) {
  const eligibility = heldInvitationEligibility(organization);
  if (eligibility.state !== "invite_eligible") return eligibility;
  try {
    // This is deliberately an invitation-needed outbox record, not a
    // deliverable email: minting a claim credential without an authorized
    // sender would make it unrecoverable. A later human-approved delivery path
    // must mint the one-time token and send it in the same controlled workflow.
    const inserted = await queueClaimInvitationNeed(database, organization, eligibility);
    return { state: inserted ? "invite_queued" : "invite_already_queued" };
  } catch (error) {
    if (error?.statusCode === 409) return { state: "invite_already_queued" };
    throw error;
  }
}

export function freshnessCycle(kind, confirmedAt) {
  const timestamp = new Date(confirmedAt || Date.now());
  if (Number.isNaN(timestamp.getTime())) throw adoptionError("A valid confirmation date is required.", 422);
  const date = timestamp.toISOString().slice(0, 10);
  return kind === "hours_reminder" ? `hours-reminder-${date}` : `hours-stale-${date}`;
}
