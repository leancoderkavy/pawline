// Single source for Pawline's legal identity on the Terms, Privacy Policy, and footer.
// Keep LEGAL_ADDRESS identical to Tradewink LLC's public mailing address
// (tradewink/tradewink web/src/lib/legal-entity.ts) and the CA Statement of Information.
//
// PUBLISH GATES (do not deploy until all are true):
// 1. The Pawline fictitious business name statement for Tradewink LLC is filed with
//    LA County RR/CC. Until then "d/b/a Pawline" is not accurate.
// 2. The Arcadia mailbox's USPS Form 1583 is notarized and the mailbox is active.
// 3. privacy@ and legal@pawlineadopt.com receive mail (no MX record for the domain
//    as of 2026-11-27).
// 4. LEGAL_EFFECTIVE_DATE is set to the deploy date.
export const LEGAL_ENTITY = "Tradewink LLC";
export const LEGAL_ENTITY_DESCRIPTION = "a California limited liability company doing business as Pawline";
export const LEGAL_ENTITY_DBA = "Tradewink LLC d/b/a Pawline";
export const LEGAL_ADDRESS = "411 E Huntington Dr, Ste 107 #1334, Arcadia, CA 91006";
export const LEGAL_EMAIL = "legal@pawlineadopt.com";
export const PRIVACY_EMAIL = "privacy@pawlineadopt.com";
export const LEGAL_EFFECTIVE_DATE = "[set on publish]";
