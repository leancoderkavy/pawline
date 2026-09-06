# Pawline search visibility

Reviewed 2026-09-06. Canonical property: https://www.pawlineadopt.com/.

## Audit and implementation

The guide routes previously redirected to homepage fragments and the sitemap contained only the homepage. This prevented the guides from being separate search landing pages. The four existing resources now render HTML at canonical URLs, with specific titles, descriptions, social metadata, and WebPage structured data. The map still opens the same resources in its existing panels. Site-wide links and the sitemap expose the canonical resources. The concise and extended llms.txt references link to those same pages.

Google's [AI search guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) prioritizes useful content and ordinary SEO. It says llms.txt does not affect Google ranking. These files serve other consumers as source references, not as ranking promises. No generated drafts are published automatically. No geographic doorway pages or invented local inventory are added.

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

The signed-in Search Console account did not list Pawline at audit time. A canonical URL-prefix property was initiated and its Google-issued ownership file is included in this release. Complete verification after deployment, then submit `https://www.pawlineadopt.com/sitemap.xml`. Keep the verification file deployed.

After Google has processed data, export the Performance report's Queries CSV in English. Compare equal completed date ranges with identical search type, country, device, and page filters. Store exports under ignored `output/search-console/` and run:

```powershell
python scripts/search_rankings.py output/search-console/Queries.csv output/search-console/previous-Queries.csv > output/search-console/rankings.json
```

The report computes CTR, measured average position, and positive position improvement. Queries with at least 100 impressions and average position 4–20 are flagged for title and intent review; this is an internal prioritization heuristic. Missing observations stay unknown. GSC omits some query data; reports are not an exhaustive keyword census. See the [Search Analytics documentation](https://developers.google.com/webmaster-tools/v1/searchanalytics/query).

Check indexing of the five sitemap URLs, Google-selected canonicals, and mobile experience. Inspect AI search performance separately when the property exposes that report. Verification, sitemap acceptance, indexing, and ranking changes are separate outcomes.

## Petfinder research

The public [homepage](https://www.petfinder.com/), [shelter search](https://www.petfinder.com/animal-shelters-and-rescues/search/), and [adoption checklist page](https://www.petfinder.com/adopt-or-get-involved/adopting-pets/how-to/adoption-checklist/) were inspected through web research. Petfinder exposes distinct animal search, shelter search, and adoption education paths. Pawline's implementation applies the useful structural lesson: searchable educational pages that link back to the discovery experience. It does not copy their articles, photographs, or animal records.

`scripts/petfinder_research.py` is a bounded metadata/link scraper: up to five public pages, robots preflight, minimum two-second spacing, response-size limits, no redirects or credentials, and no database writes. Candidate links remain unverified leads. Run:

```powershell
python scripts/petfinder_research.py https://www.petfinder.com/ https://www.petfinder.com/animal-shelters-and-rescues/search/
```

The live direct-fetch attempt on 2026-09-06 received HTTP 403 on robots.txt and stopped without requesting listing pages. Evidence: `output/petfinder-research-20260906.json`. This is an access blocker, not a successful inventory import. Do not bypass the block. Any later animal-data integration needs an accessible authorized feed and verified field mappings; the existing authorized-feed importer remains separate.
