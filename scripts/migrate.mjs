import fs from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const dryRun = process.argv.slice(2).includes("--dry-run");
const schemaUrl = new URL("../db/schema.sql", import.meta.url);
const schema = await fs.readFile(schemaUrl, "utf8");

if (!dryRun && !process.env.DATABASE_URL) {
  const envFile = new URL("../.env.local", import.meta.url);
  try {
    const rawEnv = await fs.readFile(envFile, "utf8");
    for (const line of rawEnv.split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#")) {
        continue;
      }
      const idx = line.indexOf("=");
      if (idx <= 0) {
        continue;
      }
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim().replace(/^\"|\"$/g, "");
      if (key === "DATABASE_URL" && !process.env.DATABASE_URL) {
        process.env.DATABASE_URL = value;
      }
    }
  } catch {
    // Keep behavior explicit if env file is unavailable.
  }
}

if (!dryRun && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const sql = dryRun ? null : neon(process.env.DATABASE_URL);

function splitSqlStatements(input) {
  const statements = [];
  let start = 0;
  let singleQuote = false;
  let doubleQuote = false;
  let lineComment = false;
  let blockComment = false;
  let dollarQuote = null;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];

    if (lineComment) {
      if (character === "\n") {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (dollarQuote) {
      if (input.startsWith(dollarQuote, index)) {
        index += dollarQuote.length - 1;
        dollarQuote = null;
      }
      continue;
    }

    if (!singleQuote && !doubleQuote && character === "-" && next === "-") {
      lineComment = true;
      index += 1;
      continue;
    }

    if (!singleQuote && !doubleQuote && character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }

    if (!doubleQuote && character === "'") {
      if (singleQuote && next === "'") {
        index += 1;
      } else {
        singleQuote = !singleQuote;
      }
      continue;
    }

    if (!singleQuote && character === '"') {
      if (doubleQuote && next === '"') {
        index += 1;
      } else {
        doubleQuote = !doubleQuote;
      }
      continue;
    }

    if (!singleQuote && !doubleQuote && character === "$") {
      const match = input.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) {
        dollarQuote = match[0];
        index += dollarQuote.length - 1;
        continue;
      }
    }

    if (!singleQuote && !doubleQuote && character === ";") {
      const statement = input.slice(start, index).trim();
      if (statement) {
        statements.push(statement);
      }
      start = index + 1;
    }
  }

  if (singleQuote || doubleQuote || blockComment || dollarQuote) {
    throw new Error("Schema SQL contains an unterminated quoted value or comment.");
  }

  const trailingStatement = input.slice(start).trim();
  if (trailingStatement) {
    statements.push(trailingStatement);
  }

  return statements;
}

const statements = splitSqlStatements(schema);
if (!dryRun) {
  for (const statement of statements) {
    await sql.query(statement);
  }
}

let verification = null;
if (!dryRun) [verification] = await sql`
  SELECT
    to_regclass('public.sources') AS sources,
    to_regclass('public.pets') AS pets,
    to_regclass('public.pet_submission_files') AS pet_submission_files,
    to_regclass('public.pet_submission_log') AS pet_submission_log,
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
    to_regclass('public.direct_conversation_state') AS direct_conversation_state,
    to_regclass('public.direct_video_calls') AS direct_video_calls,
    to_regclass('public.direct_video_signals') AS direct_video_signals,
    to_regclass('public.direct_messages_idempotency') AS direct_messages_idempotency,
    to_regclass('public.direct_messages_page') AS direct_messages_page,
    to_regclass('public.direct_video_one_active') AS direct_video_one_active,
    to_regclass('public.direct_video_recent') AS direct_video_recent,
    to_regclass('public.direct_video_signals_call') AS direct_video_signals_call,
    to_regclass('public.seo_content_jobs') AS seo_content_jobs,
    to_regclass('public.seo_content_sources') AS seo_content_sources,
    to_regclass('public.seo_content_drafts') AS seo_content_drafts,
    to_regclass('public.shelter_outreach_candidates') AS shelter_outreach_candidates,
    to_regclass('public.shelter_outreach_emails') AS shelter_outreach_emails,
    to_regclass('public.organizations') AS organizations,
    to_regclass('public.organization_locations') AS organization_locations,
    to_regclass('public.organization_memberships') AS organization_memberships,
    to_regclass('public.organization_claim_tokens') AS organization_claim_tokens,
    to_regclass('public.organization_hours') AS organization_hours,
    to_regclass('public.organization_hour_exceptions') AS organization_hour_exceptions,
    to_regclass('public.organization_verification_events') AS organization_verification_events,
    to_regclass('public.adopter_profiles') AS adopter_profiles,
    to_regclass('public.households') AS households,
    to_regclass('public.household_members') AS household_members,
    to_regclass('public.adoption_applications') AS adoption_applications,
    to_regclass('public.adoption_application_answers') AS adoption_application_answers,
    to_regclass('public.adoption_application_documents') AS adoption_application_documents,
    to_regclass('public.adoption_application_consents') AS adoption_application_consents,
    to_regclass('public.adoption_application_events') AS adoption_application_events,
    to_regclass('public.adoption_application_messages') AS adoption_application_messages,
    to_regclass('public.adoption_outcome_confirmations') AS adoption_outcome_confirmations,
    to_regclass('public.adoption_placement_checkins') AS adoption_placement_checkins,
    to_regclass('public.organization_email_suppressions') AS organization_email_suppressions,
    to_regclass('public.organization_outreach_messages') AS organization_outreach_messages,
    to_regclass('public.organization_email_events') AS organization_email_events,
    to_regclass('public.organization_reviews') AS organization_reviews,
    to_regclass('public.organization_review_evidence') AS organization_review_evidence,
    to_regclass('public.organization_review_evidence_access_log') AS organization_review_evidence_access_log,
    to_regclass('public.organization_review_replies') AS organization_review_replies,
    to_regclass('public.organization_review_appeals') AS organization_review_appeals,
    to_regclass('public.ai_task_consents') AS ai_task_consents,
    to_regclass('public.ai_task_runs') AS ai_task_runs,
    to_regclass('public.ai_evaluation_results') AS ai_evaluation_results,
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
    to_regclass('public.seo_content_jobs_queue') AS seo_content_jobs_queue,
    to_regclass('public.shelter_outreach_candidates_queue') AS shelter_outreach_candidates_queue,
    to_regclass('public.shelter_outreach_emails_candidate_created') AS shelter_outreach_emails_candidate_created,
    to_regclass('public.organizations_verification_fresh') AS organizations_verification_fresh,
    to_regclass('public.organizations_contact_email') AS organizations_contact_email,
    to_regclass('public.organization_locations_one_primary') AS organization_locations_one_primary,
    to_regclass('public.organization_locations_organization') AS organization_locations_organization,
    to_regclass('public.organization_memberships_user') AS organization_memberships_user,
    to_regclass('public.organization_claim_tokens_redeem') AS organization_claim_tokens_redeem,
    to_regclass('public.organization_verification_recent') AS organization_verification_recent,
    to_regclass('public.pets_organization_public') AS pets_organization_public,
    to_regclass('public.sources_organization_id') AS sources_organization_id,
    to_regclass('public.direct_conversations_organization_recent') AS direct_conversations_organization_recent,
    to_regclass('public.households_owner') AS households_owner,
    to_regclass('public.household_members_user') AS household_members_user,
    to_regclass('public.adoption_applications_adopter_recent') AS adoption_applications_adopter_recent,
    to_regclass('public.adoption_applications_organization_queue') AS adoption_applications_organization_queue,
    to_regclass('public.adoption_application_events_history') AS adoption_application_events_history,
    to_regclass('public.adoption_application_messages_history') AS adoption_application_messages_history,
    to_regclass('public.adoption_placement_checkins_due') AS adoption_placement_checkins_due,
    to_regclass('public.organization_outreach_messages_status') AS organization_outreach_messages_status,
    to_regclass('public.organization_reviews_public') AS organization_reviews_public,
    to_regclass('public.organization_reviews_one_interaction') AS organization_reviews_one_interaction,
    to_regclass('public.organization_reviews_one_application') AS organization_reviews_one_application,
    to_regclass('public.organization_review_evidence_access_history') AS organization_review_evidence_access_history,
    to_regclass('public.ai_task_consents_user_task') AS ai_task_consents_user_task,
    to_regclass('public.ai_task_consents_application_task') AS ai_task_consents_application_task,
    to_regclass('public.ai_task_runs_task_recent') AS ai_task_runs_task_recent,
    (SELECT count(*)::integer
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='pets'
        AND column_name IN ('claimed_by_clerk_user_id', 'claimed_by_display_name', 'claimed_at')) AS ownership_columns
`;

const requiredTables = [
  "sources", "pets", "pet_submission_files", "pet_submission_log", "ingestion_runs",
  "ratings", "adoption_events", "web_discoveries",
  "community_messages", "community_reports", "community_leads", "usage_limits",
  "user_favorites", "direct_conversations", "direct_messages", "direct_message_reports",
  "direct_conversation_state", "direct_video_calls", "direct_video_signals",
  "seo_content_jobs", "seo_content_sources", "seo_content_drafts",
  "shelter_outreach_candidates", "shelter_outreach_emails",
  "organizations", "organization_locations", "organization_memberships", "organization_claim_tokens",
  "organization_hours", "organization_hour_exceptions", "organization_verification_events",
  "adopter_profiles", "households", "household_members", "adoption_applications",
  "adoption_application_answers", "adoption_application_documents", "adoption_application_consents",
  "adoption_application_events", "adoption_application_messages", "adoption_outcome_confirmations",
  "adoption_placement_checkins",
  "organization_email_suppressions", "organization_outreach_messages", "organization_email_events",
  "organization_reviews", "organization_review_evidence", "organization_review_evidence_access_log",
  "organization_review_replies", "organization_review_appeals", "ai_task_consents", "ai_task_runs",
  "ai_evaluation_results",
];
const requiredIndexes = [
  "direct_messages_idempotency", "direct_messages_page", "direct_video_one_active", "direct_video_recent", "direct_video_signals_call",
  "pets_source_external_unique", "pets_public_search", "pets_source_id",
  "pet_submission_files_pet_id", "pet_submission_log_pet_id",
  "adoption_events_source_external_unique", "web_discoveries_fresh",
  "community_messages_room_created", "usage_limits_expiry",
  "user_favorites_user_created", "direct_conversations_owner_recent",
  "direct_conversations_inquirer_recent", "direct_messages_conversation_created", "seo_content_jobs_queue",
  "shelter_outreach_candidates_queue", "shelter_outreach_emails_candidate_created",
  "organizations_verification_fresh", "organization_locations_one_primary", "organization_memberships_user",
  "organizations_contact_email", "organization_locations_organization",
  "organization_claim_tokens_redeem", "organization_verification_recent", "pets_organization_public",
  "sources_organization_id", "direct_conversations_organization_recent", "households_owner", "household_members_user",
  "adoption_applications_adopter_recent", "adoption_applications_organization_queue",
  "adoption_application_events_history", "adoption_application_messages_history",
  "adoption_placement_checkins_due",
  "organization_outreach_messages_status", "organization_reviews_public",
  "organization_reviews_one_interaction",
  "organization_reviews_one_application",
  "organization_review_evidence_access_history", "ai_task_consents_user_task", "ai_task_runs_task_recent",
  "ai_task_consents_application_task",
];
if (dryRun) {
  const missingTables = requiredTables.filter((name) => !new RegExp(`\\bCREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${name}\\b`, "i").test(schema));
  const missingIndexes = requiredIndexes.filter((name) => !new RegExp(`\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+IF\\s+NOT\\s+EXISTS\\s+${name}\\b`, "i").test(schema));
  const hasOwnershipColumns = ["claimed_by_clerk_user_id", "claimed_by_display_name", "claimed_at"]
    .every((column) => new RegExp(`\\b${column}\\b`, "i").test(schema));
  if (!statements.length || missingTables.length || missingIndexes.length || !hasOwnershipColumns) {
    console.error("Migration dry run failed:", { statements: statements.length, tables: missingTables, indexes: missingIndexes, hasOwnershipColumns });
    throw new Error("Schema dry run did not find every required migration artifact.");
  }
  console.log(`Pawline database schema dry run passed (${statements.length} SQL statements; no database connection used).`);
} else if (
  requiredTables.some((name) => !verification?.[name])
  || requiredIndexes.some((name) => !verification?.[name])
  || Number(verification?.ownership_columns) !== 3
) {
  const missingTables = requiredTables.filter((name) => !verification?.[name]);
  const missingIndexes = requiredIndexes.filter((name) => !verification?.[name]);
  const ownershipColumns = Number(verification?.ownership_columns);
  console.error("Missing migration artifacts:", {
    tables: missingTables,
    indexes: missingIndexes,
    ownershipColumns,
  });
  throw new Error("Database migration did not create every required table, index, and ownership column.");
}

if (!dryRun) console.log("Pawline database schema is current.");
