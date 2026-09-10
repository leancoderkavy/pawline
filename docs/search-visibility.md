# Pawline search visibility

Reviewed 2026-09-08. Canonical property: https://www.pawlineadopt.com/.

## Audit and implementation

The guide routes previously redirected to homepage fragments and the sitemap contained only the homepage. This prevented the guides from being separate search landing pages. The four existing resources now render HTML at canonical URLs, with specific titles, descriptions, social metadata, and WebPage structured data. The map still opens the same resources in its existing panels. Site-wide links and the sitemap expose the canonical resources. The concise and extended llms.txt references link to those same pages.

Google's [AI search guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) prioritizes useful content and ordinary SEO. It says llms.txt does not affect Google ranking. These files serve other consumers as source references, not as ranking promises. No generated drafts are published automatically. No geographic doorway pages or invented local inventory are added.

Production verification also found that configured authentication reduced homepage prerendering to a loading sentence. The authentication loading state now supplies a public adoption heading, source-confirmation summary, and guide links while keeping the existing authenticated landing decision. A build with a syntactically valid test publishable key confirms this content exists in the prerendered HTML.

## Keyword map

These are intent targets, not measured ranks or search-volume estimates.

| Target query cluster | Canonical landing page | Purpose |
| --- | --- | --- |
| adoptable dogs and cats near me; pet adoption map | `/` | Search current source-backed listings |
| how to find adoptable pets near you | `/guides/find-adoptable-pets-near-you` | Explain location, record classes, and source confirmation |
| find a pet that fits my home; pet adoption matching | `/guides/find-a-pet-that-fits-your-home-and-routine` | Compare listing facts and household needs |
| pet adoption guides | `/guides` | Navigate educational resources |
| Pawline listing sources; how Pawline works | `/how-pawline-works` | Explain evidence, unknowns, and availability |

Prioritize these existing pages before creating more topics. Use actual GSC impressions and query intent to choose subsequent improvements. Do not infer rankings from a single personalized search or from absent queries.

## Search Console operation

The signed-in Search Console account did not list Pawline at audit time. A canonical URL-prefix property was initiated and its Google-issued ownership file is included in this release. Ownership was verified on 2026-09-06 after deployment and `https://www.pawlineadopt.com/sitemap.xml` was submitted. Keep the verification file deployed. Search Console is initially processing property performance data; no measured ranking baseline is available yet. Sitemap submission is not proof of successful processing or indexing; inspect its current status in GSC.

After Google has processed data, export the Performance report's Queries CSV in English. Compare equal completed date ranges with identical search type, country, device, and page filters. Store exports under ignored `output/search-console/` and run:

```powershell
python scripts/search_rankings.py output/search-console/Queries.csv output/search-console/previous-Queries.csv --current-context output/search-console/current.json --previous-context output/search-console/previous.json > output/search-console/rankings.json
```

The report computes CTR, measured average position, and positive position improvement. Queries with at least 100 impressions and average position 4–20 are flagged for title and intent review; this is an internal prioritization heuristic. Missing observations stay unknown. GSC omits some query data; reports are not an exhaustive keyword census. See the [Search Analytics documentation](https://developers.google.com/webmaster-tools/v1/searchanalytics/query).

Check indexing of the six sitemap URLs, Google-selected canonicals, and mobile experience. Inspect AI search performance separately when the property exposes that report. Verification, sitemap acceptance, indexing, and ranking changes are separate outcomes.

## Petfinder research

The public [homepage](https://www.petfinder.com/), [shelter search](https://www.petfinder.com/animal-shelters-and-rescues/search/), and [adoption checklist page](https://www.petfinder.com/adopt-or-get-involved/adopting-pets/how-to/adoption-checklist/) were inspected through web research. Petfinder exposes distinct animal search, shelter search, and adoption education paths. Pawline's implementation applies the useful structural lesson: searchable educational pages that link back to the discovery experience. It does not copy their articles, photographs, or animal records.

`scripts/petfinder_research.py` is a bounded metadata/link scraper: up to five public pages, robots preflight, minimum two-second spacing, response-size limits, no redirects or credentials, and no database writes. Candidate links remain unverified leads. Run:

```powershell
python scripts/petfinder_research.py https://www.petfinder.com/ https://www.petfinder.com/animal-shelters-and-rescues/search/
```

The live direct-fetch attempt on 2026-09-06 received HTTP 403 on robots.txt and stopped without requesting listing pages. Evidence: `output/petfinder-research-20260906.json`. This is an access blocker, not a successful inventory import. Do not bypass the block. Any later animal-data integration needs an accessible authorized feed and verified field mappings; the existing authorized-feed importer remains separate.

## Five follow-up improvements (2026-09-08)

1. Shared resource catalog, visible breadcrumbs, BreadcrumbList schema, and related reading connect the guide hierarchy. See Google's [breadcrumb guidance](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb).
2. `/guides/questions-to-ask-before-adopting` provides an original shelter-conversation checklist with six printable checkboxes and ASPCA references. It is linked from the map guide panel, sitemap, and both LLM reference files. Target intent: questions to ask a shelter before adopting.
3. AI draft validation requires two distinct supplied sources in both citations and article links, restricts internal links to published resources, and checks FAQ claims. Drafts still require human publication review.
4. Ranking comparisons require matching property, search type, filters, and equal non-overlapping date ranges. Missing queries remain unknown, including queries seen only in the previous export. Export totals are observed query totals, not property totals.
5. CI audits initial HTML for every sitemap page: heading, title, description, canonical, indexability, and resource schema. Claim, moderation, and API responses carry noindex directives; this is indexing control, not access control. See Google's [robots directives](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag).

Each comparison context file records the actual export settings. Example `current.json` (illustrative dates, not measurements):

```json
{"site":"https://www.pawlineadopt.com/","searchType":"web","startDate":"2026-08-08","endDate":"2026-08-14","filters":{}}
```

The corresponding previous context uses August 1 through August 7 with the same property, type, and filters. Record any country, device, or page filter in `filters`; empty means unfiltered. Never label mismatched exports as comparable.

Run the crawlability audit locally and after deployment:

```powershell
python scripts/audit_search.py --build-dir .next/server/app
python scripts/audit_search.py --base-url https://www.pawlineadopt.com
```

On September 8, GSC Performance showed zero clicks, zero impressions, and no query rows; available chart dates were September 5–6. Indexing was still processing. There is no measurable ranking baseline or demonstrated ranking gain. Petfinder's prior robots 403 remains an unresolved access boundary; this follow-up adds no imported inventory.

## Internal navigation follow-up (2026-09-08)

The initial-HTML audit now checks same-origin HTML link destinations and article
fragment IDs, including relative and cross-page links. It rejects noncanonical
Pawline origins and reports missing pages and anchors. Live requests are cached,
limited to 32 destinations, and do not follow redirects or external links. API
links and path traversal are rejected before fetching. Homepage hash routes
remain browser-tested application navigation rather than static element IDs.

This caught the standalone source-methodology page's `#guides/matching` link,
which now opens the canonical matching guide. Its map-panel version retains the
application hash. The audit runs in existing CI and supports the same production
verification command. It does not measure Google indexing or ranking changes.

## Five further rounds (2026-09-09)

- Resource summaries are visible beside the breadcrumb and match each page's structured description.
- Both LLM reference files group the checklist with the other canonical guides; the extended reference review date is current.
- GSC CSV imports reject duplicate columns and missing or extra row fields before reporting metrics.
- The search audit checks Open Graph/Twitter metadata presence, canonical social URLs, and HTTPS image URLs. Image delivery remains a separate check.
- The audit checks robots.txt for the canonical sitemap and public-resource access for Googlebot, Bingbot, OAI-SearchBot, and PerplexityBot. This is a configuration check, not proof of crawler visits.

These changes extend the existing six-page search surface. No ranking gain or fresh inventory is inferred. Google's [AI search guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) states that special AI files and markup are not required for Google Search.

## Five follow-up rounds: guide navigation and data consistency

Guide pages now provide a keyboard-visible skip link that targets focusable article content. Shared metadata supplies consistent social titles, image dimensions, and image alternative text across all five resource pages.

`node scripts/sync-search-resources.mjs` updates only marked guide sections in both LLM reference files from the resource catalog. CI runs it with `--check` to reject drift while keeping explanatory content hand-maintained.

GSC reports now include current/previous query counts, shared queries, queries present in only one export, and the number eligible for position deltas. These are export coverage counts, not an estimate of all searches. Missing periods remain unknown.

The structured-data audit accepts object, array, and graph forms and rejects malformed roots with an actionable error. It also validates that each resource WebPage actually references its BreadcrumbList. These checks establish technical consistency, not indexing or ranking gains.
