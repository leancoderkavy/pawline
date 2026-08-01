import dns from "node:dns/promises";
import https from "node:https";
import net from "node:net";
import { generateText, jsonSchema, Output } from "ai";
import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import { ensureCommunityTables } from "./_community.js";
import { consumeUsageChain } from "./_usage-limit.js";

const MODEL = process.env.PAWLINE_AI_MODEL || "google/gemini-2.5-flash-lite";
const MAX_HTML = 600_000;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;
const buckets = new Map();
const parsedListingSchema = jsonSchema({
  type: "object",
  additionalProperties: false,
  required: ["name", "species", "breed", "age", "city", "country", "description", "imageUrl"],
  properties: {
    name: { type: "string" },
    species: { type: "string", enum: ["", "Dog", "Cat"] },
    breed: { type: "string" },
    age: { type: "string" },
    city: { type: "string" },
    country: { type: "string" },
    description: { type: "string" },
    imageUrl: { type: "string" },
  },
});

function mappedIpv4(address) {
  const value = String(address).toLowerCase();
  if (!value.startsWith("::ffff:")) return null;
  const suffix = value.slice(7);
  if (net.isIP(suffix) === 4) return suffix;
  const words = suffix.split(":");
  if (words.length !== 2 || words.some(word => !/^[0-9a-f]{1,4}$/.test(word))) return null;
  const high = Number.parseInt(words[0], 16);
  const low = Number.parseInt(words[1], 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

export function isPrivateIp(address) {
  const family = net.isIP(address);
  if (!family) return true;
  const mapped = family === 6 ? mappedIpv4(address) : null;
  if (mapped) return isPrivateIp(mapped);
  if (family === 6) {
    return /^(?:::|::1$|f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:|ff[0-9a-f]{2}:|2001:db8:)/i.test(address);
  }
  const octets = address.split(".").map(Number);
  const [a, b, c] = octets;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113);
}

async function safeUrl(input) {
  const url = new URL(String(input || ""));
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("Use a public HTTPS listing link on the standard secure port.");
  }
  const records = await dns.lookup(url.hostname, { all: true });
  if (!records.length || records.some((record) => isPrivateIp(record.address))) throw new Error("That link cannot be fetched safely.");
  return { url, address: records[0].address, family: records[0].family };
}

function fetchSafeHtml({ url, address, family }) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: "GET",
      headers: { "User-Agent": "PawlineLinkPreview/1.0 (+https://www.pawlineadopt.com)" },
      servername: url.hostname,
      lookup: (_hostname, _options, callback) => callback(null, address, family),
    }, (upstream) => {
      const status = Number(upstream.statusCode || 0);
      const contentType = String(upstream.headers["content-type"] || "");
      const length = Number(upstream.headers["content-length"] || 0);
      if (status < 200 || status >= 300 || upstream.headers.location || !contentType.includes("text/html")) {
        upstream.resume();
        reject(new Error("That page did not return a readable pet listing."));
        return;
      }
      if (length > MAX_HTML) {
        upstream.resume();
        reject(new Error("That listing page is too large to parse safely."));
        return;
      }
      const chunks = [];
      let received = 0;
      upstream.on("data", (chunk) => {
        received += chunk.length;
        if (received > MAX_HTML) {
          request.destroy(new Error("That listing page is too large to parse safely."));
          return;
        }
        chunks.push(chunk);
      });
      upstream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
    request.setTimeout(12_000, () => request.destroy(new Error("That listing page timed out.")));
    request.on("error", (error) => {
      const safeMessages = [
        "That listing page is too large to parse safely.",
        "That listing page timed out.",
      ];
      reject(new Error(safeMessages.includes(error.message)
        ? error.message
        : "That listing page could not be fetched safely."));
    });
    request.end();
  });
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
  response.setHeader("Cache-Control", "no-store");
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
  if (rateLimited(user.id)) {
    return response.status(429).json({ error: "Link parsing limit reached. Try again later." });
  }
  try {
    const reservation = await consumeUsageChain(database, [
      { scope: "community_link_parse_user", subject: user.id, limit: MAX_REQUESTS_PER_WINDOW, windowMs: WINDOW_MS },
      { scope: "community_link_parse_global", subject: "all", limit: 200, windowMs: WINDOW_MS },
    ]);
    if (!reservation.allowed) {
      return response.status(429).json({ error: "Link parsing limit reached. Try again later." });
    }
  } catch {
    return response.status(503).json({ error: "Link parsing safety checks are temporarily unavailable." });
  }
  if (!process.env.VERCEL && !process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    return response.status(503).json({ error: "Pet link parsing is not configured." });
  }
  try {
    const target = await safeUrl(request.body?.url);
    const { url } = target;
    const html = await fetchSafeHtml(target);
    const fallback = {
      title: meta(html, "og:title") || decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]).slice(0, 180),
      description: meta(html, "og:description") || meta(html, "description"),
      imageUrl: meta(html, "og:image"),
    };
    const visibleText = decode(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).slice(0, 12_000);
    const { output } = await generateText({
      model: MODEL,
      output: Output.object({
        schema: parsedListingSchema,
        name: "community_pet_listing",
        description: "Explicit public facts extracted from a third-party pet listing.",
      }),
      system: [
        "Extract only explicit public pet-listing facts from the supplied webpage.",
        "Never infer a pet's temperament, health, ownership, precise address, availability, or identity.",
        "Never output contact details, exact street addresses, microchip IDs, or personal names.",
        "Return the requested structured fields; species is Dog, Cat, or an empty string.",
        "Use an empty string for unsupported fields. The description must be a neutral summary under 500 characters.",
      ].join(" "),
      prompt: JSON.stringify({ url: url.href, metadata: fallback, pageText: visibleText }),
      temperature: 0,
      maxOutputTokens: 600,
      abortSignal: AbortSignal.timeout(20_000),
    });
    const pet = validateParsed(output, fallback);
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
        longitude=EXCLUDED.longitude, verification_state='needs_confirmation',
        parser_state='parsed', updated_at=now()
      RETURNING id
    `;
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
