import { getDatabase } from "./_db.js";
import { cleanupUsageLimits } from "./_usage-limit.js";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const FRESH_DAYS = 14;

export const DISCOVERY_AREAS = [
  {
    query: "adoptable dog cat official animal shelter Los Angeles California",
    city: "Los Angeles, California",
    latitude: 34.0522,
    longitude: -118.2437,
  },
  {
    query: "adoptable dog cat official animal shelter Seattle Washington",
    city: "Seattle, Washington",
    latitude: 47.6062,
    longitude: -122.3321,
  },
  {
    query: "adoptable dog cat official animal shelter Montgomery County Maryland",
    city: "Montgomery County, Maryland",
    latitude: 39.1547,
    longitude: -77.2405,
  },
];

const cleanText = (value, maxLength) =>
  String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

export function normalizeTavilyResult(result, area) {
  const title = cleanText(result?.title, 180);
  const snippet = cleanText(result?.content, 800);
  const sourceUrl = String(result?.url || "");
  const searchable = `${title} ${snippet}`.toLowerCase();
  if (
    !title ||
    !isHttpsUrl(sourceUrl) ||
    !/(adopt|available (?:animals|dogs|cats|pets)|pet listings)/.test(searchable) ||
    /(facebook\.com|instagram\.com|tiktok\.com|youtube\.com)/.test(sourceUrl)
  ) {
    return null;
  }
  const species =
    /\bdogs?\b/.test(searchable) && !/\bcats?\b/.test(searchable)
      ? "Dog"
      : /\bcats?\b/.test(searchable) && !/\bdogs?\b/.test(searchable)
        ? "Cat"
        : null;
  return {
    title,
    snippet,
    sourceUrl,
    domain: new URL(sourceUrl).hostname.replace(/^www\./, ""),
    city: area.city,
    latitude: area.latitude,
    longitude: area.longitude,
    species,
  };
}

export async function requireDiscoverySchema(database) {
  const rows = await database`
    SELECT to_regclass('public.web_discoveries') IS NOT NULL AS web_discoveries
  `;
  if (!rows[0]?.web_discoveries) {
    throw new Error("Web discovery migration is missing.");
  }
}

async function searchArea(area, apiKey) {
  const upstream = await fetch(TAVILY_SEARCH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Project-ID": "pawline-adoption-discovery",
    },
    body: JSON.stringify({
      query: area.query,
      topic: "general",
      search_depth: "basic",
      country: "united states",
      max_results: 5,
      include_answer: false,
      include_images: false,
      include_raw_content: false,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!upstream.ok) {
    throw new Error(`Tavily returned ${upstream.status}`);
  }
  const payload = await upstream.json();
  if (!Array.isArray(payload.results)) {
    throw new Error("Tavily returned an invalid result set");
  }
  return {
    requestId: payload.request_id || null,
    credits: Number(payload.usage?.credits || 1),
    leads: payload.results.map((result) => normalizeTavilyResult(result, area)).filter(Boolean),
  };
}

export async function runTavilyDiscovery() {
  const database = getDatabase();
  const apiKey = process.env.TAVILY_API_KEY;
  if (!database) throw new Error("DATABASE_URL is required");
  if (!apiKey) throw new Error("TAVILY_API_KEY is required");
  await requireDiscoverySchema(database);
  const expiredUsageLimits = await cleanupUsageLimits(database);

  const settled = await Promise.allSettled(
    DISCOVERY_AREAS.map((area) => searchArea(area, apiKey)),
  );
  let credits = 0;
  let upserted = 0;
  const errors = [];
  for (const [index, result] of settled.entries()) {
    if (result.status === "rejected") {
      errors.push({
        area: DISCOVERY_AREAS[index].city,
        error: result.reason instanceof Error ? result.reason.message : "Search failed",
      });
      continue;
    }
    credits += result.value.credits;
    for (const lead of result.value.leads) {
      await database`
        INSERT INTO web_discoveries (
          title, snippet, source_url, source_domain, city,
          latitude, longitude, species, status, last_seen_at
        ) VALUES (
          ${lead.title}, ${lead.snippet}, ${lead.sourceUrl}, ${lead.domain},
          ${lead.city}, ${lead.latitude}, ${lead.longitude}, ${lead.species},
          'current', now()
        )
        ON CONFLICT (source_url) DO UPDATE SET
          title=EXCLUDED.title,
          snippet=EXCLUDED.snippet,
          source_domain=EXCLUDED.source_domain,
          city=EXCLUDED.city,
          latitude=EXCLUDED.latitude,
          longitude=EXCLUDED.longitude,
          species=EXCLUDED.species,
          status='current',
          last_seen_at=now(),
          updated_at=now()
      `;
      upserted += 1;
    }
  }
  await database`
    UPDATE web_discoveries
    SET status='stale', updated_at=now()
    WHERE status='current'
      AND last_seen_at < now() - (${FRESH_DAYS} * interval '1 day')
  `;
  console.log(JSON.stringify({
    level: errors.length ? "warning" : "info",
    msg: "tavily_discovery_complete",
    searches: DISCOVERY_AREAS.length,
    credits,
    upserted,
    expiredUsageLimits,
    errors,
  }));
  return { searches: DISCOVERY_AREAS.length, credits, upserted, expiredUsageLimits, errors };
}
