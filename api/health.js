export default function handler(_request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({
    ok: true,
    service: "pawline",
    rescueGroupsConfigured: Boolean(process.env.RESCUEGROUPS_API_KEY),
    activePetProviders: process.env.RESCUEGROUPS_API_KEY ? 1 : 0,
  });
}
