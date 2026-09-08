# Shelter search and saved-search reliability

## Shelter locations during an upstream outage

The previous release observed repeated Overpass timeouts on the default Pasadena search. This release keeps up to 1,000 public search snapshots in PostgreSQL so successful lookups survive server restarts. A snapshot is fresh for 15 minutes; during a failed refresh, nonempty results up to seven days old can be served with an explicit stale notice and their original observation time. Empty or older snapshots are not presented as proof that there are no shelters.

Refreshes are coalesced within an instance and leased in PostgreSQL across instances. Failed refreshes have a persisted cooldown. A 429 is not immediately retried or routed to another public server. Responses are byte-bounded, and partial/error payloads cannot overwrite good snapshots. The source is still subject to upstream availability; these changes reduce repeated work and preserve useful information during outages.

If no usable snapshot exists, a small reviewed directory supplies nearby locations for five LA Animal Services facilities already mapped by the pet provider. These are public location records, not shelter accounts, partnerships, or available animals. The names and addresses were checked against [LA Animal Services' official contact directory](https://www.laanimalservices.com/give-us-feedback) on September 8, 2026. Directory results are distance-filtered and visibly labelled as limited coverage. Areas without a snapshot or a reviewed location retain an honest unavailable state.

The [Overpass operator guidance](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html) explains its shared capacity and recommends dedicated infrastructure for broader application demand. This release does not rotate public endpoints or provision a paid provider. A dedicated service or authorized shelter-directory feed remains the path to broad reliable coverage.

## Saved searches

“New pets since saved” filters by the saved timestamp before database pagination, so old first-page results cannot hide later new records. Both new-only and full-match views preserve their saved filters while loading later pages. The active fields reflect the selected saved search. Lost-and-found city input is separate from adoption search, and editing criteria invalidates a pending response. Existing named searches remain editable at the 20-search limit; a 21st new search is still rejected.

These are in-app checks. They do not enable scheduled email or push alerts. Existing account isolation applies to each page of a saved search.

## Migration and operation

Run `node scripts/migrate-shelter-cache.mjs --dry-run`, then the same script with the production `DATABASE_URL`. The new `db/migrations/20260908-shelter-cache.sql` adds only the disposable public cache table under the shared transaction-scoped migration lock. The general migration runner and isolated test fixture include it. Original pet, conversation, and account tables are preserved. The production migration was applied twice on September 8; pet counts remained 641 before and after each run.

Verification covers cold-instance cache reuse, concurrent request coalescing, failure cooldown, stale age limits, directory fallback attribution, malformed source payloads, 429 handling, saved-search pagination beyond 24 old results, cross-account denial, and updates at the search limit. Browser tests exercise the fallback source/detail view and the saved criteria/new-only pagination at mobile width. Production media delivery remains dependent on Daily configuration and owned-account testing from the prior release.

## Outreach

An individual email was sent to LA Animal Services' published website contact, asking about an authorized pet feed, attribution and image permissions, corrections/removal, and an optional shelter pilot. Sent-history and suppression checks found no prior contact or opt-out for that address. Gmail returned a SENT receipt; delivery and reply are not confirmed. No repeat messages were sent to the two organizations contacted in the preceding round, and no automatic follow-up was enabled.
