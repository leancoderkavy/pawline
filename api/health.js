export default function handler(_request, response) {
  const communityDatabaseConfigured = Boolean(process.env.DATABASE_URL);
  const rescueGroupsConfigured = Boolean(process.env.RESCUEGROUPS_API_KEY);
  const mapboxConfigured = Boolean(process.env.MAPBOX_ACCESS_TOKEN);
  const emailConfigured = Boolean(
    process.env.RESEND_API_KEY &&
      process.env.PAWLINE_FROM_EMAIL &&
      process.env.PAWLINE_MODERATION_EMAIL,
  );
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({
    ok: true,
    service: "pawline",
    rescueGroupsConfigured,
    mapboxConfigured,
    emailConfigured,
    communityDatabaseConfigured,
    submissionsConfigured: communityDatabaseConfigured,
    scheduledIngestionConfigured: communityDatabaseConfigured && Boolean(process.env.CRON_SECRET),
    publicOpenDataProviders: 2,
    activePetProviders:
      2 + Number(rescueGroupsConfigured) + Number(communityDatabaseConfigured),
  });
}
