# Adoption quality release - 2026-09-10

The competitive review exposed a useful product standard: make nearby discovery, listing evidence, and the shelter's actual next step easy to understand. This release addresses defects across that journey.

## Changes
- Restore the browsable pet list alongside the map, including species present in the loaded feed.
- Evaluate behavioral phrases conservatively: names and breeds are not behavior evidence, negated traits cannot count as support, missing facts earn no support, and all concerns/questions remain available.
- Surface household conflicts before higher-scoring candidates and sort unknown/invalid distances after known distances.
- Replace the quiz's percentage match claim with the number of supporting facts.
- Distinguish recent feed observations from old/invalid timestamps and actual availability confirmation.
- Put official shelter contact, visit preparation, and private-draft boundaries on the pet detail page.
- Preserve official listing links in saved applications across sessions through the authenticated API.
- Make the canonical llms resource checker independent of Windows line endings.

## Verification boundaries
Automated checks cover mobile/desktop navigation, failure recovery, guest privacy, shelter import, messaging, appointments, matching regressions, search metadata, and dependency advisories. Browser fixtures are not production inventory or real shelter participation. Feed observation is not staff confirmation. These changes do not establish ranking gains, more inventory, completed adoptions, or production authenticated video acceptance.

## Remaining product measurements
Track coverage and stale-listing rates by region/species, official-contact conversion, shelter response time, application completion, and verified adoption outcomes. GSC position and indexing trends require comparable observation windows after deployment. Increasing authorized inventory and confirming shelter participation require actual provider and organization evidence; no new outreach or paid services were activated by this release.
