import fs from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const schemaUrl = new URL("../db/schema.sql", import.meta.url);
const schema = await fs.readFile(schemaUrl, "utf8");
const sql = neon(process.env.DATABASE_URL);

await sql.query(schema);

const [verification] = await sql`
  SELECT
    to_regclass('public.sources') AS sources,
    to_regclass('public.pets') AS pets,
    to_regclass('public.pet_submission_files') AS submission_files,
    to_regclass('public.pet_submission_log') AS submission_log,
    to_regclass('public.ingestion_runs') AS ingestion_runs,
    to_regclass('public.ratings') AS ratings,
    to_regclass('public.adoption_events') AS adoption_events,
    to_regclass('public.web_discoveries') AS web_discoveries,
    to_regclass('public.community_messages') AS community_messages,
    to_regclass('public.community_reports') AS community_reports,
    to_regclass('public.community_leads') AS community_leads,
    to_regclass('public.usage_limits') AS usage_limits,
    to_regclass('public.user_favorites') AS user_favorites,
    to_regclass('public.direct_conversations') AS direct_conversations,
    to_regclass('public.direct_messages') AS direct_messages,
    to_regclass('public.direct_message_reports') AS direct_message_reports,
    to_regclass('public.pets_source_external_unique') AS pets_source_external_unique,
    to_regclass('public.pets_public_search') AS pets_public_search,
    to_regclass('public.pets_source_id') AS pets_source_id,
    to_regclass('public.pet_submission_files_pet_id') AS pet_submission_files_pet_id,
    to_regclass('public.pet_submission_log_pet_id') AS pet_submission_log_pet_id,
    to_regclass('public.adoption_events_source_external_unique') AS adoption_events_source_external_unique,
    to_regclass('public.web_discoveries_fresh') AS web_discoveries_fresh,
    to_regclass('public.community_messages_room_created') AS community_messages_room_created,
    to_regclass('public.usage_limits_expiry') AS usage_limits_expiry,
    to_regclass('public.user_favorites_user_created') AS user_favorites_user_created,
    to_regclass('public.direct_conversations_owner_recent') AS direct_conversations_owner_recent,
    to_regclass('public.direct_conversations_inquirer_recent') AS direct_conversations_inquirer_recent,
    to_regclass('public.direct_messages_conversation_created') AS direct_messages_conversation_created,
    (SELECT count(*)::integer
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='pets'
        AND column_name IN ('claimed_by_clerk_user_id', 'claimed_by_display_name', 'claimed_at')) AS ownership_columns
`;

const requiredTables = [
  "sources", "pets", "submission_files", "submission_log", "ingestion_runs",
  "ratings", "adoption_events", "web_discoveries",
  "community_messages", "community_reports", "community_leads", "usage_limits",
  "user_favorites", "direct_conversations", "direct_messages", "direct_message_reports",
];
const requiredIndexes = [
  "pets_source_external_unique", "pets_public_search", "pets_source_id",
  "pet_submission_files_pet_id", "pet_submission_log_pet_id",
  "adoption_events_source_external_unique", "web_discoveries_fresh",
  "community_messages_room_created", "usage_limits_expiry",
  "user_favorites_user_created", "direct_conversations_owner_recent",
  "direct_conversations_inquirer_recent", "direct_messages_conversation_created",
];
if (
  requiredTables.some((name) => !verification?.[name])
  || requiredIndexes.some((name) => !verification?.[name])
  || Number(verification?.ownership_columns) !== 3
) {
  throw new Error("Database migration did not create every required table, index, and ownership column.");
}

console.log("Pawline database schema is current.");
