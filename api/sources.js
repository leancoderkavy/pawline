import { getDatabase } from "./_db.js";
import { PUBLIC_SHELTERS } from "../config/public-shelters.js";
const sourceCatalog = [
  {
    id: "rescuegroups",
    name: "RescueGroups",
    scope: "United States and Canada",
    recordAccess: "Public adoptable-pet API",
    status: process.env.RESCUEGROUPS_API_KEY ? "active" : "awaiting_key",
    onboarding: "requested",
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
    onboarding: "requested",
  },
  {
    id: "shelterluv",
    name: "Shelterluv",
    scope: "Per participating organization",
    recordAccess: "Shelter-authorized credentials required",
    status: "organization_credentials_required",
    onboarding: "requested",
  },
  {
    id: "petpoint",
    name: "PetPoint",
    scope: "Per participating organization",
    recordAccess: "Shelter-specific integration required",
    status: "organization_credentials_required",
    onboarding: "requested",
  },
  {
    id: "animal-shelter-manager",
    name: "Animal Shelter Manager",
    scope: "Per participating organization, worldwide",
    recordAccess: "Shelter-enabled JSON/CSV adoptable-animal service",
    status: "organization_feed_required",
    onboarding: "organization_by_organization",
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

export function observedSource(row, now = Date.now()) {
  const last = row.last_success_at ? new Date(row.last_success_at).getTime() : null;
  return { name: row.name, attribution: row.attribution, termsUrl: row.terms_url, enabled: row.enabled, lastSuccessAt: row.last_success_at, lastAttemptAt: row.last_run_at, availableRecords: Number(row.available_count || 0), state: !row.enabled ? "disabled" : row.last_error ? "error" : !last ? "never_synced" : now - last > 48 * 3600000 ? "stale" : "current" };
}
export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  response.setHeader("Cache-Control", "public, s-maxage=300");
  let inventory = null, observed = [], observationStatus = "unavailable";
  const database = getDatabase();
  if (database) {
    try {
      const [rows, counts] = await Promise.all([
        database`SELECT s.id,s.name,s.attribution,s.terms_url,s.enabled,s.last_success_at,s.last_run_at,s.last_error,
          count(p.id) FILTER (WHERE p.status='available' AND p.verified_at IS NOT NULL)::integer AS available_count
          FROM sources s LEFT JOIN pets p ON p.source_id=s.id GROUP BY s.id ORDER BY s.name`,
        database`SELECT (SELECT count(*)::integer FROM pets WHERE status='available' AND verified_at IS NOT NULL) AS available,
          (SELECT count(*)::integer FROM organizations) AS organizations,
          (SELECT count(DISTINCT organization_id)::integer FROM organization_memberships) AS participating_organizations`,
      ]);
      observed = rows.map(row => observedSource(row)); inventory = counts[0]; observationStatus = "observed";
    } catch { /* Unknown counts stay unknown when storage cannot be observed. */ }
  }
  return response.status(200).json({
    directory: { locations: PUBLIC_SHELTERS.length, reviewedAt: "2026-09-08", scope: "Selected Los Angeles city shelters; not participating shelter accounts" },
    inventory, observed, observationStatus, observedAt: new Date().toISOString(),
    sources: sourceCatalog,
    active: sourceCatalog.filter((source) => source.status === "active").length,
    note: "Stored inventory counts exclude live provider totals and web leads. Source configuration is not proof of feed health. No single public database contains every adoptable pet worldwide.",
  });
}
