import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSeoResearchResult,
  requireSeoPipelineSchema,
  validateSeoBrief,
  validateSeoDraft,
} from "../api/_ai-seo-pipeline.js";
import seoPipelineHandler from "../api/seo-pipeline.js";
import seoPipelineCronHandler from "../api/cron/seo-pipeline.js";

const research = [
  {
    title: "Preparing to adopt a dog",
    excerpt: "A primary shelter source with preparation guidance.",
    sourceUrl: "https://example.org/adopt-a-dog",
    sourceDomain: "example.org",
  },
  {
    title: "Questions for a shelter",
    excerpt: "An adoption organization explains questions to ask before adoption.",
    sourceUrl: "https://example.net/adoption-questions",
    sourceDomain: "example.net",
  },
];

function validDraft() {
  const body = Array.from({ length: 60 }, () => "Prepare a calm home, read the source details, and confirm current requirements with the shelter.").join(" ");
  return {
    title: "How to Prepare Your Home Before Adopting a Dog",
    slug: "prepare-home-before-adopting-a-dog",
    metaDescription: "Use this source-grounded checklist to prepare your home, ask practical questions, and confirm current adoption requirements with a shelter.",
    excerpt: "A practical, source-grounded overview of home preparation and the questions first-time adopters can bring to a shelter conversation.",
    outline: [
      { heading: "Start with the shelter's information", purpose: "Use official listing and adoption information as the source of truth." },
      { heading: "Prepare your household", purpose: "Plan household routines before a dog arrives." },
      { heading: "Confirm the next steps", purpose: "Bring open questions to the shelter." },
    ],
    articleMarkdown: `## Start with source information\n\n${body}\n\n[Preparing to adopt a dog](https://example.org/adopt-a-dog)\n\n## Confirm next steps\n\n${body}\n\n[Questions for a shelter](https://example.net/adoption-questions)`,
    faq: [
      { question: "What should I ask a shelter before adoption?", answer: "Ask the shelter to explain the current application, meeting, and care expectations for the specific animal." },
      { question: "Should I rely on a guide for availability?", answer: "No. Confirm current availability and requirements directly with the shelter or rescue." },
    ],
    citations: [
      { sourceUrl: "https://example.org/adopt-a-dog", claim: "The article's preparation guidance is based on this source." },
      { sourceUrl: "https://example.net/adoption-questions", claim: "The article's questions section is based on this source." },
    ],
    internalLinks: [
      { anchor: "Pawline adoption discovery map", url: "https://www.pawlineadopt.com/" },
    ],
  };
}

function responseCapture() {
  const result = { status: null, body: null };
  return {
    result,
    setHeader() { return this; },
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; },
  };
}

test("AI SEO briefs require a focused topic, intent, and audience", () => {
  assert.match(validateSeoBrief({ focusKeyword: "dog", intent: "informational" }).error, /audience/i);
  const result = validateSeoBrief({
    focusKeyword: " how to adopt a dog ", intent: "informational", audience: "first-time adopters", location: "Los Angeles",
  });
  assert.equal(result.value.focusKeyword, "how to adopt a dog");
  assert.equal(result.value.location, "Los Angeles");
});

test("AI SEO research retains public HTTPS sources and excludes social pages", () => {
  const result = normalizeSeoResearchResult({
    title: "Official adoption guide", url: "https://shelter.example.org/adopt", content: "Public shelter preparation guidance.",
  });
  assert.equal(result.sourceDomain, "shelter.example.org");
  assert.equal(normalizeSeoResearchResult({
    title: "Social post", url: "https://instagram.com/example", content: "Adoption information",
  }), null);
});

test("AI SEO drafts pass only with known source citations and review-safe output", () => {
  const result = validateSeoDraft(validDraft(), research);
  assert.equal(result.report.passed, true);
  assert.equal(result.value.citations.length, 2);
  assert.ok(result.report.wordCount >= 700);
});

test("AI SEO drafts reject certainty claims and citations outside supplied research", () => {
  const draft = validDraft();
  draft.articleMarkdown += " This guide guarantees a perfect match. [Unapproved](https://unknown.example/source)";
  const result = validateSeoDraft(draft, research);
  assert.equal(result.report.passed, false);
  assert.ok(result.report.blockers.some((blocker) => /prohibited/i.test(blocker)));
  assert.ok(result.report.blockers.some((blocker) => /outside/i.test(blocker)));
});

test("AI SEO pipeline fails closed when the migration is absent", async () => {
  const database = async () => [{ jobs: false, sources: false, drafts: false }];
  await assert.rejects(requireSeoPipelineSchema(database), /migration is missing/i);
});

test("AI SEO operator and cron endpoints fail closed before private configuration", async () => {
  const savedAdminSecret = process.env.SEO_PIPELINE_SECRET;
  const savedCronSecret = process.env.CRON_SECRET;
  delete process.env.SEO_PIPELINE_SECRET;
  delete process.env.CRON_SECRET;
  try {
    const operator = responseCapture();
    await seoPipelineHandler({ method: "GET", headers: {}, query: {} }, operator);
    assert.equal(operator.result.status, 503);
    const cron = responseCapture();
    await seoPipelineCronHandler({ method: "GET", headers: {} }, cron);
    assert.equal(cron.result.status, 401);
  } finally {
    if (savedAdminSecret === undefined) delete process.env.SEO_PIPELINE_SECRET;
    else process.env.SEO_PIPELINE_SECRET = savedAdminSecret;
    if (savedCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = savedCronSecret;
  }
});
