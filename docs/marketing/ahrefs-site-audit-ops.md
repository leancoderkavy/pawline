# Ops: Ahrefs Site Audit for pawlineadopt.com (KAV-29)

**STATUS: ENG TICKETED — needs Kavy in Ahrefs dashboard**

## Why

KAV-29 asks to add an Ahrefs Site Audit project for [pawlineadopt.com](https://www.pawlineadopt.com/) and continue GSC watch only (no near-me warfare until supply).

## Current state (checked via Ahrefs API)

- Rank Tracker / Site Audit project lists include Tradewink, Palytt, Kitsuvo, Sybqa, etc.
- **No project** exists for `pawlineadopt.com` / `www.pawlineadopt.com`.
- Site Audit crawl start is dashboard-only; the Ahrefs API exposes audit *reads* (`site-audit-projects`, issues, page explorer) but not audit project creation/start.

## What Kavy must do

1. In Ahrefs → **Site Audit** → create a project for `https://www.pawlineadopt.com/` (prefer `www` canonical; include subdomains only if needed).
2. Optionally create the matching **Project** in Ahrefs Project settings so Rank Tracker / GSC connectors can attach later.
3. Run the first crawl; keep scheduled audits on.
4. Continue **GSC** watch only for query/index signals — do not expand city/near-me landings until KAV-27 supply exists.

## Eng / agent follow-up after Kavy creates it

- Confirm the project appears in `site-audit-projects` (filter `project_url=pawlineadopt.com`).
- Track health score / errors in ops notes; do not treat audit health as ranking proof.
