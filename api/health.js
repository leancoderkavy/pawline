export default function handler(_request, response) {
  const communityDatabaseConfigured = Boolean(process.env.DATABASE_URL);
  const rescueGroupsConfigured = Boolean(process.env.RESCUEGROUPS_API_KEY);
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({
    ok: true,
    service: "pawline",
    rescueGroupsConfigured,
    communityDatabaseConfigured,
    submissionsConfigured: communityDatabaseConfigured,
    scheduledIngestionConfigured: communityDatabaseConfigured && Boolean(process.env.CRON_SECRET),
    activePetProviders: Number(rescueGroupsConfigured) + Number(communityDatabaseConfigured),
  });
}
