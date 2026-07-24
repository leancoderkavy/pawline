const sourceCatalog = [
  {
    id: "rescuegroups",
    name: "RescueGroups",
    scope: "United States and Canada",
    recordAccess: "Public adoptable-pet API",
    status: process.env.RESCUEGROUPS_API_KEY ? "active" : "awaiting_key",
  },
  {
    id: "adoptapet",
    name: "Adopt a Pet",
    scope: "United States and Canada",
    recordAccess: "Search API partnership required",
    status: "partner_approval_required",
  },
  {
    id: "shelterluv",
    name: "Shelterluv",
    scope: "Per participating organization",
    recordAccess: "Shelter-authorized credentials required",
    status: "organization_credentials_required",
  },
  {
    id: "petpoint",
    name: "PetPoint",
    scope: "Per participating organization",
    recordAccess: "Shelter-specific integration required",
    status: "organization_credentials_required",
  },
];

export default function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  response.setHeader("Cache-Control", "public, s-maxage=300");
  return response.status(200).json({
    sources: sourceCatalog,
    active: sourceCatalog.filter((source) => source.status === "active").length,
    note: "No single public database contains every adoptable pet worldwide.",
  });
}
