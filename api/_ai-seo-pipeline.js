import { SEARCH_ORIGIN, searchResources } from "../src/resources/searchCatalog.js";

export const approvedSeoLinks = [
  { anchor: "Pawline adoption discovery map", url: `${SEARCH_ORIGIN}/` },
  ...searchResources.map(resource => ({ anchor: resource.title, url: `${SEARCH_ORIGIN}${resource.path}` })),
];
const approvedSeoUrls = new Set([...approvedSeoLinks.map(link => link.url), `${SEARCH_ORIGIN}/llms.txt`]);

const MAX_SOURCES = 6;
const MAX_TOPIC_LENGTH = 140;
const ALLOWED_INTENTS = new Set(["informational", "commercial", "navigational"]);
const BLOCKED_SOURCE_HOSTS = /(?:^|\.)(?:facebook\.com|instagram\.com|tiktok\.com|youtube\.com|pinterest\.com)$/i;

const cleanText = (value, limit) => String(value || "")
  .replace(/<[^>]*>/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const cleanMarkdown = (value, limit) => String(value || "")
  .replace(/\r/g, "")
  .replace(/\u0000/g, "")
  .trim()
  .slice(0, limit);

const unique = (values) => [...new Set(values)];

function httpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

function jsonValue(value, fallback) {
  if (value && typeof value === "object") return value;
  try { return JSON.parse(value || ""); } catch { return fallback; }
}

function wordCount(value) {
  return cleanMarkdown(value, 20_000).split(/\s+/).filter(Boolean).length;
}

function urlsInMarkdown(markdown) {
  return unique([...String(markdown || "").matchAll(/https?:\/\/[^\s)\]]+/g)].map((match) => match[0]));
}

export function validateSeoBrief(body) {
  const focusKeyword = cleanText(body?.focusKeyword, MAX_TOPIC_LENGTH);
  const intent = cleanText(body?.intent, 32).toLowerCase();
  const audience = cleanText(body?.audience, 180);
  const location = cleanText(body?.location, 120) || null;
  const angle = cleanText(body?.angle, 360) || null;
  if (focusKeyword.length < 3) return { error: "A focus keyword of at least 3 characters is required." };
  if (!ALLOWED_INTENTS.has(intent)) return { error: "Intent must be informational, commercial, or navigational." };
  if (audience.length < 3) return { error: "A target audience is required." };
  return { value: { focusKeyword, intent, audience, location, angle } };
}

export function normalizeSeoResearchResult(result) {
  const sourceUrl = httpsUrl(result?.url);
  const title = cleanText(result?.title, 180);
  const excerpt = cleanText(result?.content, 1200);
  if (!sourceUrl || !title || !excerpt || BLOCKED_SOURCE_HOSTS.test(sourceUrl.hostname)) return null;
  return {
    title,
    excerpt,
    sourceUrl: sourceUrl.href,
    sourceDomain: sourceUrl.hostname.replace(/^www\./, "").toLowerCase(),
  };
}

export async function requireSeoPipelineSchema(database) {
  const rows = await database`
    SELECT
      to_regclass('public.seo_content_jobs') IS NOT NULL AS jobs,
      to_regclass('public.seo_content_sources') IS NOT NULL AS sources,
      to_regclass('public.seo_content_drafts') IS NOT NULL AS drafts
  `;
  if (!rows[0]?.jobs || !rows[0]?.sources || !rows[0]?.drafts) {
    throw new Error("AI SEO pipeline migration is missing.");
  }
}

export function validateSeoDraft(payload, researchSources) {
  const title = cleanText(payload?.title, 80);
  const slug = cleanText(payload?.slug, 100).toLowerCase().replace(/^-+|-+$/g, "");
  const metaDescription = cleanText(payload?.metaDescription, 190);
  const excerpt = cleanText(payload?.excerpt, 360);
  const articleMarkdown = cleanMarkdown(payload?.articleMarkdown, 18_000);
  const outline = Array.isArray(payload?.outline) ? payload.outline.map((item) => ({
    heading: cleanText(item?.heading, 120), purpose: cleanText(item?.purpose, 300),
  })).filter((item) => item.heading && item.purpose).slice(0, 8) : [];
  const faq = Array.isArray(payload?.faq) ? payload.faq.map((item) => ({
    question: cleanText(item?.question, 180), answer: cleanText(item?.answer, 600),
  })).filter((item) => item.question && item.answer).slice(0, 5) : [];
  const knownSourceUrls = new Set(researchSources.map((source) => source.sourceUrl));
  const citations = Array.isArray(payload?.citations) ? payload.citations.map((item) => ({
    sourceUrl: String(item?.sourceUrl || ""), claim: cleanText(item?.claim, 360),
  })).filter((item) => knownSourceUrls.has(item.sourceUrl) && item.claim).slice(0, MAX_SOURCES) : [];
  const internalLinks = Array.isArray(payload?.internalLinks) ? payload.internalLinks.map((item) => ({
    anchor: cleanText(item?.anchor, 100), url: String(item?.url || ""),
  })).filter((item) => item.anchor && approvedSeoUrls.has(item.url)).slice(0, 3) : [];
  const blockers = [];
  const warnings = [];
  const markdownUrls = urlsInMarkdown(articleMarkdown);
  const unknownMarkdownUrls = markdownUrls.filter((url) => !knownSourceUrls.has(url) && !approvedSeoUrls.has(url));
  const prohibitedClaims = [
    /\b(?:guarantee|guaranteed|always|never)\b/i,
    /\b(?:cure|treat|diagnos(?:e|is|ed|ing)|medical advice)\b/i,
    /\b(?:legally required|legal advice|attorney)\b/i,
    /\b(?:perfect match|best match|adoption decision)\b/i,
    /\b(?:currently available|available now)\b/i,
  ].filter((pattern) => pattern.test(`${title} ${metaDescription} ${excerpt} ${articleMarkdown} ${faq.map(item => `${item.question} ${item.answer}`).join(" ")}`));
  if (title.length < 30 || title.length > 70) blockers.push("Title must be 30–70 characters.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) blockers.push("Slug must use lowercase letters, numbers, and hyphens only.");
  if (metaDescription.length < 120 || metaDescription.length > 165) blockers.push("Meta description must be 120–165 characters.");
  if (excerpt.length < 80) blockers.push("Excerpt is too short.");
  if (outline.length < 3) blockers.push("Draft needs at least three outline sections.");
  if (wordCount(articleMarkdown) < 700) blockers.push("Article needs at least 700 words.");
  if (faq.length < 2) blockers.push("Draft needs at least two FAQ answers.");
  if (new Set(citations.map(item => item.sourceUrl)).size < 2) blockers.push("Draft needs at least two distinct citations from the supplied research.");
  if (markdownUrls.filter(url => knownSourceUrls.has(url)).length < 2) blockers.push("Article must link at least two distinct supplied research sources in its body.");
  if (unknownMarkdownUrls.length) blockers.push("Article contains citations outside the supplied research set.");
  if (prohibitedClaims.length) blockers.push("Draft contains a prohibited certainty, advice, or availability claim.");
  if (!articleMarkdown.includes("confirm") && !articleMarkdown.includes("Confirm")) warnings.push("Add a reminder to confirm adoption details with the shelter.");
  if (!internalLinks.length) warnings.push("No approved Pawline internal link was included.");
  const report = {
    passed: blockers.length === 0,
    wordCount: wordCount(articleMarkdown),
    citationCount: citations.length,
    blockers,
    warnings,
  };
  if (blockers.length) return { report };
  return {
    value: { title, slug, metaDescription, excerpt, outline, articleMarkdown, faq, citations, internalLinks },
    report,
  };
}

function formatJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    focusKeyword: row.focus_keyword,
    brief: jsonValue(row.brief, {}),
    status: row.status,
    attempts: Number(row.attempts || 0),
    error: row.error_message || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at || null,
  };
}

export async function getSeoJob(database, jobId) {
  const [job] = await database`
    SELECT id, focus_keyword, brief, status, attempts, error_message, created_at, updated_at, completed_at
    FROM seo_content_jobs WHERE id = ${jobId}
  `;
  if (!job) return null;
  const [draft] = await database`
    SELECT title, slug, meta_description, excerpt, outline, article_markdown, faq, citations,
      internal_links, quality_report, model, created_at, updated_at
    FROM seo_content_drafts WHERE job_id = ${jobId}
  `;
  const sources = await database`
    SELECT position, title, excerpt, source_url, source_domain
    FROM seo_content_sources WHERE job_id = ${jobId} ORDER BY position
  `;
  return {
    ...formatJob(job),
    sources: sources.map((source) => ({
      position: Number(source.position), title: source.title, excerpt: source.excerpt,
      sourceUrl: source.source_url, sourceDomain: source.source_domain,
    })),
    draft: draft ? {
      title: draft.title,
      slug: draft.slug,
      metaDescription: draft.meta_description,
      excerpt: draft.excerpt,
      outline: jsonValue(draft.outline, []),
      articleMarkdown: draft.article_markdown,
      faq: jsonValue(draft.faq, []),
      citations: jsonValue(draft.citations, []),
      internalLinks: jsonValue(draft.internal_links, []),
      qualityReport: jsonValue(draft.quality_report, {}),
      model: draft.model,
      createdAt: draft.created_at,
      updatedAt: draft.updated_at,
    } : null,
  };
}
