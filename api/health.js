import { shelterOutreachStatus } from "./_shelter-outreach.js";
import { videoConfiguration } from "./_direct-video.js";
import { getDatabase } from "./_db.js";
import { ensureDirectMessageTables } from "./_direct.js";
import { dailyConfigured } from "./_daily.js";

export function getHealth(environment = process.env) {
  const communityDatabaseConfigured = Boolean(environment.DATABASE_URL);
  const rescueGroupsConfigured = Boolean(environment.RESCUEGROUPS_API_KEY);
  const mapboxConfigured = Boolean(environment.MAPBOX_ACCESS_TOKEN);
  const emailConfigured = Boolean(
    environment.RESEND_API_KEY &&
      environment.PAWLINE_FROM_EMAIL &&
      environment.PAWLINE_MODERATION_EMAIL,
  );
  const clerkConfigured = Boolean(environment.CLERK_SECRET_KEY);
  const realtimeConfigured = Boolean(environment.ABLY_API_KEY);
  return {
    ok: true,
    service: "pawline",
    rescueGroupsConfigured,
    mapboxConfigured,
    emailConfigured,
    communityDatabaseConfigured,
    submissionsConfigured: communityDatabaseConfigured,
    scheduledIngestionConfigured: communityDatabaseConfigured && Boolean(environment.CRON_SECRET),
    aiMatchingConfigured: Boolean(
      environment.VERCEL || environment.AI_GATEWAY_API_KEY || environment.VERCEL_OIDC_TOKEN,
    ),
    tavilyDiscoveryConfigured: Boolean(environment.TAVILY_API_KEY && environment.CRON_SECRET),
    aiSeoPipelineConfigured: Boolean(
      communityDatabaseConfigured && environment.TAVILY_API_KEY && environment.CRON_SECRET
      && environment.SEO_PIPELINE_SECRET
      && (environment.VERCEL || environment.AI_GATEWAY_API_KEY || environment.VERCEL_OIDC_TOKEN),
    ),
    shelterOutreach: shelterOutreachStatus(environment),
    clerkConfigured,
    directMessagingConfigured: clerkConfigured && communityDatabaseConfigured,
    videoCallingConfigured: clerkConfigured && communityDatabaseConfigured && (dailyConfigured(environment) || videoConfiguration(environment).enabled),
    videoProvider: dailyConfigured(environment) ? 'daily' : videoConfiguration(environment).enabled ? 'webrtc' : null,
    appointmentRemindersConfigured: clerkConfigured && communityDatabaseConfigured && emailConfigured && Boolean(environment.CRON_SECRET),
    realtimeCommunityConfigured: clerkConfigured && communityDatabaseConfigured && realtimeConfigured,
    communityLinkParsingConfigured: clerkConfigured && communityDatabaseConfigured && Boolean(
      environment.VERCEL || environment.AI_GATEWAY_API_KEY || environment.VERCEL_OIDC_TOKEN,
    ),
    publicOpenDataProviders: 2,
    officialDirectPetProviders: 3,
    activePetProviders:
      3 + Number(rescueGroupsConfigured) + Number(communityDatabaseConfigured),
  };
}

export function createHealthHandler(dependencies = {}) {
  const databaseForRequest = dependencies.getDatabase || getDatabase;
  const environment = dependencies.environment || process.env;
  return async function handler(request, response) {
    response.setHeader("Cache-Control", "no-store");
    if (request.method !== "GET") {
      response.setHeader("Allow", "GET");
      return response.status(405).json({ error: "Method not allowed" });
    }
    const health = getHealth(environment);
    health.directMessagingReady = false;
    if (health.directMessagingConfigured) {
      try {
        await ensureDirectMessageTables(databaseForRequest());
        health.directMessagingReady = true;
      } catch {
        // Configuration alone does not prove the production schema is current.
      }
    }
    return response.status(200).json(health);
  };
}

export default createHealthHandler();
