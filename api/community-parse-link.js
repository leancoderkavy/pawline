import dns from "node:dns/promises";
import net from "node:net";
import { generateText } from "ai";
import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import { ensureCommunityTables } from "./_community.js";

const MODEL = process.env.PAWLINE_AI_MODEL || "google/gemini-2.5-flash-lite";
const MAX_HTML = 600_000;
const buckets = new Map();

function isPrivateIp(address) {
  if (!net.isIP(address)) return true;
  return /^(?:10\.|127\.|169\.254\.|192\.168\.|0\.|::1$|fc|fd|fe80)/i.test(address) ||
    /^172\.(?:1[6-9]|2\d|3[01])\./.test(address);
}

async function safeUrl(input) {
  const url = new URL(String(input || ""));
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Use a public HTTPS listing link.");
  const records = await dns.lookup(url.hostname, { all: true });
  if (!records.length || records.some((record) => isPrivateIp(record.address))) throw new Error("That link cannot be fetched safely.");
  return url;
}

function decode(value) {
  return String(value || "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

function meta(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"),
  ];
  return decode(patterns.map((pattern) => html.match(pattern)?.[1]).find(Boolean));
}

function jsonPayload(text) {
  return JSON.parse(String(text || "").trim().replace(/^```json\s*/i, "").replace(/```$/, ""));
}

function validateParsed(payload, fallback) {
  const species = payload?.species === "Dog" || payload?.species === "Cat" ? payload.species : null;
  const clean = (value, max) => decode(value).slice(0, max) || null;
  return {
    name: clean(payload?.name, 120) || fallback.title || "Pet listing",
    species,
    breed: clean(payload?.breed, 120),
    age: clean(payload?.age, 80),
    city: clean(payload?.city, 120),
    country: clean(payload?.country, 120),
    description: clean(payload?.description, 800) || fallback.description,
    imageUrl: /^https:\/\//.test(payload?.imageUrl || "") ? payload.imageUrl : fallback.imageUrl,
  };
}

async function geocodeCity(city, country) {
  if (!city || !process.env.MAPBOX_ACCESS_TOKEN) return {};
  const query = encodeURIComponent([city, country].filter(Boolean).join(", "));
  const upstream = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?types=place,locality&limit=1&access_token=${process.env.MAPBOX_ACCESS_TOKEN}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!upstream.ok) return {};
  const feature = (await upstream.json()).features?.[0];
  return feature?.center ? { longitude: feature.center[0], latitude: feature.center[1] } : {};
}

function rateLimited(userId) {
  const now = Date.now();
  const current = buckets.get(userId);
  if (!current || now - current.startedAt > 60 * 60_000) {
    buckets.set(userId, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > 10;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "Community storage is not configured." });
  let user;
  try { user = await requireUser(request); } catch (error) {
    return response.status(error.statusCode || 401).json({ error: error.message });
  }
  if (rateLimited(user.id)) return response.status(429).json({ error: "Link parsing limit reached. Try again later." });
  if (!process.env.VERCEL && !process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    return response.status(503).json({ error: "Pet link parsing is not configured." });
  }
  try {
    const url = await safeUrl(request.body?.url);
    const upstream = await fetch(url, {
      redirect: "error",
      headers: { "User-Agent": "PawlineLinkPreview/1.0 (+https://www.pawlineadopt.com)" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!upstream.ok || !String(upstream.headers.get("content-type") || "").includes("text/html")) {
      throw new Error("That page did not return a readable pet listing.");
    }
    const length = Number(upstream.headers.get("content-length") || 0);
    if (length > MAX_HTML) throw new Error("That listing page is too large to parse safely.");
    const html = (await upstream.text()).slice(0, MAX_HTML);
    const fallback = {
      title: meta(html, "og:title") || decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]).slice(0, 180),
      description: meta(html, "og:description") || meta(html, "description"),
      imageUrl: meta(html, "og:image"),
    };
    const visibleText = decode(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).slice(0, 12_000);
    const result = await generateText({
      model: MODEL,
      system: [
        "Extract only explicit public pet-listing facts from the supplied webpage.",
        "Never infer a pet's temperament, health, ownership, precise address, availability, or identity.",
        "Never output contact details, exact street addresses, microchip IDs, or personal names.",
        "Return JSON only with keys name, species (Dog, Cat, or null), breed, age, city, country, description, imageUrl.",
        "Use null for unsupported fields. The description must be a neutral summary under 500 characters.",
      ].join(" "),
      prompt: JSON.stringify({ url: url.href, metadata: fallback, pageText: visibleText }),
      temperature: 0,
      maxOutputTokens: 600,
      abortSignal: AbortSignal.timeout(20_000),
    });
    const pet = validateParsed(jsonPayload(result.text), fallback);
    if (!pet.species && !/\b(?:dog|cat|puppy|kitten|pet)\b/i.test(`${pet.name} ${pet.description}`)) {
      throw new Error("That page does not appear to contain a dog or cat listing.");
    }
    const coordinates = await geocodeCity(pet.city, pet.country);
    await ensureCommunityTables(database);
    const rows = await database`
      INSERT INTO community_leads (
        submitted_by_clerk_user_id, source_url, source_domain, name, species,
        breed, age, description, image_url, city, country, latitude, longitude
      ) VALUES (
        ${user.id}, ${url.href}, ${url.hostname.replace(/^www\./, "")}, ${pet.name},
        ${pet.species}, ${pet.breed}, ${pet.age}, ${pet.description}, ${pet.imageUrl},
        ${pet.city}, ${pet.country}, ${coordinates.latitude || null}, ${coordinates.longitude || null}
      )
      ON CONFLICT (source_url) DO UPDATE SET
        name=EXCLUDED.name, species=EXCLUDED.species, breed=EXCLUDED.breed,
        age=EXCLUDED.age, description=EXCLUDED.description, image_url=EXCLUDED.image_url,
        city=EXCLUDED.city, country=EXCLUDED.country, latitude=EXCLUDED.latitude,
        longitude=EXCLUDED.longitude, updated_at=now()
      RETURNING id
    `;
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({
      lead: {
        id: rows[0].id,
        ...pet,
        sourceUrl: url.href,
        sourceDomain: url.hostname.replace(/^www\./, ""),
        verificationState: "needs_confirmation",
        ...coordinates,
      },
      boundary: "Outside links are community leads requiring confirmation, not provider-verified listings.",
    });
  } catch (error) {
    return response.status(422).json({ error: error.message || "We could not parse that listing." });
  }
}

