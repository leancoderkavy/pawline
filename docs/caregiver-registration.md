# Local shelter, rescue, and foster registration

The map's **More → Shelters & fosters** entry (`/#shelter`, also reachable from `/shelter/register`) offers account creation and sign-in. Verified-email account holders can register one new caregiver profile. Existing team members can register a separate profile for their own foster work. Registration never matches a name to an imported organization, grants access to an existing team, or awards verification.

The workspace lets administrators submit pets for that profile, see pending and published submissions, mark pets adopted or unavailable, and open Messages. The listing form also routes shelter/rescue/foster users through this workspace. Pet submissions carry a server-checked organization ID; names supplied by the client do not determine ownership. Existing individual caretaker listings remain supported.

Public adopters start private questions from an approved, available pet's detail page. Current organization members can answer in the existing messaging workspace. Pending pets cannot receive new public inquiries, and changing submitted content returns the listing to review. Removing membership revokes access to that organization's pets and messages.

Registration collects a public profile name, caregiver type, city, region, country, and an authority attestation. It does not request foster home addresses or publish account emails. Optional AI record extraction is separate from normal submission: photos can be submitted without an AI call. Provider imports remain managed by their source.

## Release requirements

Run `npm run db:migrate` using the intended database before deploying the application. The migration expands the organization kind constraint to include `foster` and adds the private, account-keyed `caregiver_registrations` table. No existing organization is reassigned. Missing migration state returns a temporary-unavailable response. The previous application can run against the expanded schema; leave the new table and foster rows in place on code rollback.

Registration and listing approval are separate. Pawline moderation is still required to publish pets. New profiles start unverified with application intake paused; the existing invitation-based organization claiming route remains available. Registration does not automatically connect external APIs or send outreach.

## Verification

- `npm test`: PostgreSQL-backed registration → submission with photo → moderation gate → question → caregiver reply → adoption status, plus existing suites. Includes cross-account denial, membership revocation, repeat registration, parallel retries, upgrade, and migration replay.
- `npm run build` and `npm run db:migrate:dry-run`.
- Disposable browser fixture: `PAWLINE_CHAT_PORT=4328 node e2e/chat-server.mjs`, then `http://127.0.0.1:4328/?caregiver=1&user=adopter`. Uses fixture identities, an in-memory PostgreSQL database, and no email delivery. `user=stranger` supplies a separate account; `welcome=1` shows the signed-out introduction. This is UI/API testing, not proof of live Clerk authentication or production deployment.
- Browser checks covered foster and rescue registration, required-field validation, profile/location prefill, pending submission visibility after reload/account switching, adopted status, inbox navigation, and no horizontal overflow at 360, 390, and 430 CSS pixels.
