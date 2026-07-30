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
    clerkConfigured,
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

export default function handler(_request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(getHealth());
}
