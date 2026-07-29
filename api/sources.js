const sourceCatalog = [
  {
    id: "rescuegroups",
    name: "RescueGroups",
    scope: "United States and Canada",
    recordAccess: "Public adoptable-pet API",
    status: process.env.RESCUEGROUPS_API_KEY ? "active" : "awaiting_key",
  },
  {
    id: "mapbox",
    name: "Mapbox",
    scope: "Global location search and map imagery",
    recordAccess: "Temporary geocoding and Static Images APIs",
    status: process.env.MAPBOX_ACCESS_TOKEN ? "active" : "awaiting_key",
  },
  {
    id: "tavily",
    name: "Tavily",
    scope: "Current public adoption pages in selected United States metros",
    recordAccess: "Basic web search; results remain clearly labeled discovery leads",
    status: process.env.TAVILY_API_KEY ? "active" : "awaiting_key",
  },
  {
    id: "resend",
    name: "Resend",
    scope: "Submission acknowledgement and moderation alerts",
    recordAccess: "Verified sending domain and API key required",
    status:
      process.env.RESEND_API_KEY &&
      process.env.PAWLINE_FROM_EMAIL &&
      process.env.PAWLINE_MODERATION_EMAIL
        ? "active"
        : "awaiting_domain_and_key",
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
  {
    id: "animal-shelter-manager",
    name: "Animal Shelter Manager",
    scope: "Per participating organization, worldwide",
    recordAccess: "Shelter-enabled JSON/CSV adoptable-animal service",
    status: "organization_feed_required",
  },
  {
    id: "montgomery-county-md",
    name: "Montgomery County Animal Services",
    scope: "Montgomery County, Maryland, United States",
    recordAccess: "Government open-data JSON/CSV; updated every two hours",
    status: "active",
  },
  {
    id: "king-county-wa",
    name: "King County Regional Animal Services",
    scope: "King County, Washington, United States",
    recordAccess: "Government open-data feed for lost, found, and adoptable pets",
    status: "active",
  },
  {
    id: "los-angeles-city-ca",
    name: "LA Animal Services",
    scope: "Los Angeles, California, United States",
    recordAccess: "Official live adoptable-pet pages mapped to City animal shelters",
    status: "active",
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
