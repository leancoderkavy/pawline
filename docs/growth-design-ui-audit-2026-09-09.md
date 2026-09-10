# Pawline Growth Design Audit — 2026-09-09

## Diagnostic summary

**Context and objective:** Consumer pet adoption discovery, with a separate caregiver workflow. Help an adopter find a plausible pet, verify the source, and take an informed next step; help a caregiver register and publish accurate listings. This review covers the public routes and the UI components for authenticated tools. It is not an authenticated production account audit or a conversion experiment.

**Primary cognitive bottleneck:** The interface provides substantial capability, but users sometimes learn a prerequisite only after investing effort. A navigation promise of alerts, a guest Save button, and late application eligibility information create avoidable expectation gaps. Repeated provider terminology also asks adopters to understand implementation details.

This is a heuristic review. Scores below are reviewer judgments, not measured usability scores, WCAG certification, or predicted conversion lift.

## 1. Psych framework analysis

- Motivation: real pet names, photos and source links, a branded map, guest browsing, private questions and an adoption checklist provide immediate value.
- Friction: overlapping search tools, dense menus, mixed result types, late eligibility notices, unclear persistence boundaries and capability promises deplete attention.
- Positive feedback: real profile completeness, saved states, message delivery, appointment confirmation and explicit publication review exist already.
- Subtractions addressed: manual searches called alerts; unclear guest saving; application restrictions below inputs; undifferentiated import waiting/errors; video invitations before capability is established.
- Loading: use real task descriptions such as checking a CSV. Do not fabricate processing stages, elapsed work, countdowns, social proof or completion percentages.

## 2. B.I.A.S. behavioral audit

| Dimension | Before | Finding and change |
|---|---|---|
| Block: notice and trust | Mixed | Public sources and review boundaries are explicit. Removed the unsupported alert promise and unconditional video invitations. |
| Interpret: understand | Needs work | Guest Save sounded like persistence was available. It now says Sign in to save private details and opens sign-in when configured. |
| Act: decide and proceed | Needs work | Saved-search emptiness supplied instructions without an action. Added a direct return to search. Moved eligibility/source action before application inputs. |
| Store: remember the outcome | Mixed | Import failures and success used the same announcement style. Errors now use alerts; actual preview/submission activity has specific status feedback. |

## 3. C.L.E.A.R. scorecard and rules of thumb

| Dimension | Baseline / 5 | Evidence |
|---|---:|---|
| Copywriting | 3 | Useful source explanations, but alert/video language and guest-save labels overstate or obscure the next step. |
| Layout | 3 | Map and mobile drawer are usable; long forms bury decision-changing context. |
| Emphasis | 3 | Branded primary actions are consistent; several workspace entry points compete in More. |
| Accessibility | 3 | Native buttons, dialogs and live regions are widespread. Household Remove targets were undersized; new minimum is 44×44. Full contrast/screen-reader audit remains outstanding. |
| Reward | 3 | Real confirmations exist, but profile save and import progress need clearer feedback. |
| Total | 15/25 | Directional baseline only; no artificial post-change score without user evaluation. |

Archetypes: discovery map, detail page, multi-step onboarding, private forms, conversation workspace and content guides. Guest browsing follows gradual commitment. Source and participation information should precede lengthy forms. Success means confirmed state, never a simulated adoption or publication. Native disclosure controls keep secondary map choices out of the primary path.

## 4. Behavioral antidotes and sources

[Growth.Design's psychology collection](https://growth.design/psychology) was reviewed on 2026-09-09. Relevant principles: Hick's Law and cognitive load for excess choices; progressive disclosure for secondary features; Fitts's Law for targets; mental models and feedforward for expectations; feedback loops for results; and reactance for preserving choice. These are design lenses, not a formula proving causality. B.I.A.S. and C.L.E.A.R. here are review frameworks from the local Growth Design Review skill, not claimed scientific scales or Growth.Design endorsements.

| Observed breakdown | Principle | Application |
|---|---|---|
| Alert expectation without notifications | Mental model / feedforward | Name the real capability and explain manual checks. |
| Guest Save leads to an error | Feedforward / feedback | Explicit account action; saving status for signed-in users. |
| Long form before participation restriction | Cognitive load / feedforward | Eligibility and official route before answers. |
| Import uncertainty | Feedback loop | Three honest steps; actionable errors and confirmation. |
| Video invitation despite unavailable provider | Trust / reactance | Neutral question prompts; unavailable video described without a release promise. |

## 5. Full UI coverage matrix

Source inspection includes the components named below. Browser evidence covers guest routes through app tests, private messaging/caregiver/import through fixtures, and appointment flows through their fixture suite. Fixture accounts do not prove production authentication or media delivery.

| Surface and source | Finding / status | Follow-up or change |
|---|---|---|
| Welcome — Onboarding.jsx, onboarding.css | Guest discovery is one click; caregiver/foster choices stay distinct. Compact phone layout already shipped. | Preserve; verify each path. |
| Header and More — MapNavigation.jsx | Broad menu; alerts label implies a service not enabled. | Round 1 removes promise. Future test: group adopter and caregiver destinations. |
| Map / filters / list — App.jsx, mapView.js, mapBrand.js | Distinct pins and source types; result recovery and location control already improved. | Preserve compact map options. Measure search-to-detail rate before further simplification. |
| Pet detail — App.jsx, AdopterExperience.jsx, app/pets/[id]/page.jsx | Source, availability and fit caveats exist; no guaranteed eligibility score. | Verify source links; longer-term separate adoption action from supporting detail. |
| Saved pets — App.jsx, FavoritesSync.jsx | Save state and sync-error recovery exist. | Keep browser/account boundaries visible; do not invent reminders. |
| Saved searches / directory — NetworkTools.jsx | Manual new-pet checks with pagination; empty state lacks action. | Round 1 adds behavior explanation and recovery CTA. |
| Lost/found — NetworkTools.jsx | Public reports and private tips have different audiences. | Preserve labels; private production creation not exercised. |
| Profile / household — AdopterExperience.jsx | Private fields are not persisted for guests; Save label obscures this; small Remove target. | Round 2 explicit auth CTA, save-in-flight status and larger target. |
| Match quiz — App.jsx, matching.js | Back/restart, species and optional AI consent exist. | Keep real progress and user-controlled choices. No personality certainty claims. |
| Adoption plan — AdopterExperience.jsx | Profile readiness is derived from actual completed fields. | Keep progress factual; do not imply adoption approval. |
| Applications — AdopterExperience.jsx | Share controls and 30-day private hold exist, but restriction came after fields. | Round 3 moves eligibility/source route first. |
| Writing help — ApplicationCoach.jsx | Consent and manual alternative; accepting a draft does not submit it. | Preserve user review and factual wording. |
| Application messages — AdopterExperience.jsx | Account gate and delivery feedback. | Keep distinct from general caregiver inbox; consider future navigation consolidation. |
| Direct messages — DirectMessages.jsx, DirectMessagesWorkspace.jsx | Inbox, prompts, block/report/reopen and errors; copy promises video in advance. | Round 5 neutral prompts. Capability endpoint still controls actual video. |
| Direct video — VideoCall.jsx, videoSession.js | Preview/join/end/device controls and message fallback. | Production two-account media proof still required; do not claim this audit provides it. |
| Appointments — AppointmentPanel.jsx, AppointmentForm.jsx | Proposal vs confirmed state and timezone shown. “Final visit” presumes a journey stage. | Round 5 neutral In-person visit; unavailable video is not advertised as coming soon. |
| Scheduled video — DailyAppointmentCall.jsx | Explicit join/error/end flow. | Provider configuration and production media test remain separate dependencies. |
| Community — Community.jsx | Public-channel safety, sign-in, moderation and external lead framing. | Avoid implying public chat is private; no production posts sent. |
| Caregiver onboarding — CaregiverHub.jsx | Authority checkbox, public location guidance, profile verification distinction. | Preserve city-level privacy and review language. |
| Listing submission — App.jsx, SubmissionWithAuth.jsx | Account and registration prerequisites; moderation boundaries. | Test validation without publishing fixture records to production. |
| CSV import — ShelterImport.jsx | Preview/review flow; no clear active feedback or read-error recovery. | Round 4 adds honest steps, live status, alert errors and stale-file-read protection. |
| Shelter applications — ShelterWorkspace.jsx | Role-controlled application review and follow-up. | Source review only; real organization account review remains needed. |
| Organization claim — ClaimOrganizationClient.jsx | Invitation/email prerequisite and explicit success/error. | Never redeem real invitation as a UI test. |
| Staff moderation — ReviewModerationClient.jsx | Staff gate, queue and errors. | Source review only; no staff mutations performed. |
| Guides / checklist / sources — resources/*, MapResources.jsx | Crawlable routes, actionable checklist, attribution explanation. | Preserve truthful summaries and source links. |
| Sign-in / verify — AuthModal.jsx, Dialog.jsx | Named modal, progress, validation, code resend and mode change. | Guest profile now routes here; actual credentials not entered. |
| Privacy / terms / 404 / error — app routes | Legal context and back/retry actions exist. Generic error copy is technical. | Priority 3: simplify error copy after validating recovery behavior. |

## Prioritized development plan

### Priority 1 — implemented in five rounds

| Round | Files | Outcome hypothesis to measure |
|---|---|---|
| 1. Saved-search truth and recovery | MapNavigation.jsx, NetworkTools.jsx | Fewer mistaken notification expectations; more empty-state-to-search transitions. |
| 2. Profile commitment and feedback | AdopterExperience.jsx, styles.css | Fewer guest save failures; clearer account intent and fewer duplicate save attempts. |
| 3. Eligibility before effort | AdopterExperience.jsx, styles.css | Fewer long drafts abandoned after discovering nonparticipation. |
| 4. Import progress and recovery | ShelterImport.jsx | Higher corrected-preview completion, fewer repeated clicks and stale file previews. |
| 5. Capability-aligned conversation copy | DirectMessages.jsx, DirectMessagesWorkspace.jsx, AppointmentForm.jsx | Fewer unexpected unavailable-video encounters. |

### Priority 2 — requires additional evidence

Recruit adopters and shelter staff for task-based sessions. Measure successful source contact, search-to-detail and detail-to-contact rates, time to first useful listing, corrected import completion and guest-auth abandonment. Segment mobile/desktop and guest/member. Define denominators and collect no message bodies, private answers or precise user locations in analytics. Do not present a numeric lift until an experiment or credible before/after analysis supports it.

Unify overlapping discovery entry points only after observed navigation failures. Validate real two-account chat, scheduled/direct media and role-specific shelter workflows separately when owned QA accounts and providers are available.

### Priority 3 — polish

Simplify implementation-heavy explanatory copy, audit all color contrast and keyboard focus with assistive technology, and evaluate reduced motion and long translated text. Keep safeguards visible where they affect a decision.

## Validation record

Fill final test and release evidence after execution. Public production verification is read-only; no real application, report, claim, message or listing will be submitted for this UI review.
