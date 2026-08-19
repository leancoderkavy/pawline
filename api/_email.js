const RESEND_URL = "https://api.resend.com/emails";

export function emailConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY &&
      process.env.PAWLINE_FROM_EMAIL &&
      process.env.PAWLINE_MODERATION_EMAIL,
  );
}

async function sendEmail({ to, subject, text, replyTo }) {
  return sendResendTextEmail({ to, subject, text, replyTo });
}

async function sendResendTextEmail({ to, subject, text, replyTo, idempotencyKey, fetchImpl = fetch }) {
  const response = await fetchImpl(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: process.env.PAWLINE_FROM_EMAIL,
      to: [to],
      subject,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend returned ${response.status}: ${detail.slice(0, 240)}`);
  }
  const payload = await response.json().catch(() => ({}));
  if (!payload?.id || typeof payload.id !== "string") {
    throw new Error("Resend returned no email identifier.");
  }
  return { id: payload.id };
}

export async function sendShelterConfirmationEmail({ to, subject, text, idempotencyKey, fetchImpl = fetch }) {
  if (!emailConfigured()) throw new Error("Resend is not configured.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(to || ""))) throw new Error("A valid recipient is required.");
  if (typeof subject !== "string" || !subject.trim() || subject.length > 200) throw new Error("A valid subject is required.");
  if (typeof text !== "string" || !text.trim() || text.length > 5000) throw new Error("A valid email body is required.");
  if (typeof idempotencyKey !== "string" || !idempotencyKey || idempotencyKey.length > 256) {
    throw new Error("A valid email idempotency key is required.");
  }
  return sendResendTextEmail({
    to,
    subject: subject.replace(/[\r\n]/g, " ").trim(),
    text: text.replace(/\u0000/g, ""),
    replyTo: process.env.PAWLINE_MODERATION_EMAIL,
    idempotencyKey,
    fetchImpl,
  });
}

export async function notifySubmission({ id, pet, acknowledgementEmail }) {
  if (!emailConfigured()) return { configured: false };

  const reviewText = [
    "A new Pawline community listing is waiting for review.",
    "",
    `Submission ID: ${id}`,
    `Pet: ${pet.name} (${pet.species}, ${pet.breed})`,
    `Location: ${pet.city}, ${pet.country}`,
    `Shelter/contact: ${pet.shelter}`,
    `Submitter: ${pet.email}`,
    pet.phone ? `Phone: ${pet.phone}` : null,
    pet.sourceUrl ? `Source: ${pet.sourceUrl}` : null,
    "",
    "Confirm the submitter is authorized and verify the source before publishing.",
  ]
    .filter(Boolean)
    .join("\n");

  const acknowledgementText = [
    `Thanks for submitting ${pet.name} to Pawline.`,
    "",
    "The listing is pending review and is not public yet. We may contact you to confirm authorization or availability.",
    `Submission ID: ${id}`,
    "",
    "Please reply to this email if the pet is adopted or the listing should be withdrawn.",
  ].join("\n");

  const tasks = [
    sendEmail({
      to: process.env.PAWLINE_MODERATION_EMAIL,
      replyTo: pet.email,
      subject: `Review Pawline listing: ${pet.name}`,
      text: reviewText,
    }),
  ];
  if (acknowledgementEmail) tasks.push(sendEmail({
      to: acknowledgementEmail,
      replyTo: process.env.PAWLINE_MODERATION_EMAIL,
      subject: `${pet.name}'s Pawline submission is pending review`,
      text: acknowledgementText,
    }));
  const results = await Promise.allSettled(tasks);

  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length) {
    console.error(
      "Submission email notification failed",
      failures.map((result) => result.reason?.message),
    );
  }

  return { configured: true, attempted: tasks.length, sent: results.length - failures.length };
}

export function notificationStatus(result) {
  if (!result?.configured) return "not_configured";
  if (result.sent === result.attempted) return "sent";
  return result.sent > 0 ? "partial_failure" : "failed";
}
