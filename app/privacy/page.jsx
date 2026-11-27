import { LEGAL_ADDRESS, LEGAL_EFFECTIVE_DATE, LEGAL_ENTITY, LEGAL_ENTITY_DBA, LEGAL_ENTITY_DESCRIPTION, PRIVACY_EMAIL } from "../../src/legalEntity.js";
import { PrivacyChoicesLink } from "../../src/AnalyticsConsent.jsx";

export const metadata = {
  title: "Privacy Policy",
  description: "How Pawline collects, uses, protects, and deletes information used for pet-adoption discovery and account features.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return <main className="methodology-page">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="methodology-header"><a className="methodology-brand" href="/">Pawline</a><a className="methodology-discover" href="/">Find adoptable pets <span aria-hidden="true">→</span></a></header>
    <article id="main-content" className="methodology-content legal-content" tabIndex={-1}>
      <p className="methodology-kicker">Effective {LEGAL_EFFECTIVE_DATE}</p>
      <h1>Privacy Policy</h1>
      <p className="methodology-lede">Pawline uses information only to provide pet-discovery, account, communication, application, safety, and service-reliability features. This page explains the current product behavior; it does not expand Pawline's rights to your information.</p>
      <section><h2>Who is responsible</h2>
        <p><strong>{LEGAL_ENTITY}, {LEGAL_ENTITY_DESCRIPTION}</strong>, {LEGAL_ADDRESS}, is responsible for personal information collected through pawlineadopt.com and the Pawline Adopt service. Contact: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>, the <a href="/privacy/request">privacy request form</a>, or the mailing address.</p>
      </section>
      <section><h2>Information Pawline handles</h2>
        <ul><li><strong>Ordinary request data.</strong> Public pages can receive IP address, browser and device details, requested pages, and approximate location derived from a search.</li><li><strong>Account data.</strong> If you create an account, Pawline receives identity details (name, email, sign-in identifiers) from Clerk and may store your profile preferences, favorites, messages, submissions, application drafts (which can include household and pet-care answers), consent choices, reports, and shelter-workspace activity.</li><li><strong>Location.</strong> If you allow your browser's location, Pawline uses it to find nearby pets and resources. Saved searches may include coordinates you choose to save.</li><li><strong>Photos, content you post.</strong> Reports, community posts, and messages you submit.</li><li><strong>Privacy requests.</strong> The request type, contact email and details you provide, status, and timestamps.</li><li><strong>Audio and video</strong> only when you join a live video hello. See below.</li></ul>
        <p>Pawline is free and does not take payments.</p>
      </section>
      <section><h2>How information is used</h2>
        <p>Pawline uses this information to authenticate accounts, return relevant listings, synchronize saved work, support private product workflows, prevent abuse, investigate reports, enforce limits, and maintain the service. Pawline may cache public shelter results and rounded search-area coordinates without user identifiers to reduce repeated provider requests. The cache keeps at most 1,000 recent areas; results older than seven days are not served as an outage fallback. Pawline does not treat a match score as an adoption decision.</p>
      </section>
      <section><h2>We do not sell or share your information</h2>
        <p>Pawline does not sell personal information and does not share it for cross-context behavioral advertising. We do not run advertising networks or ad pixels, and we do not use or disclose sensitive personal information to infer characteristics about you.</p>
      </section>
      <section><h2>Service providers and public sources</h2>
        <p>These providers process information for us, under their own terms and our configuration of their services:</p>
        <div className="legal-table-wrap" role="region" aria-label="Service providers table" tabIndex={0}><table>
          <thead><tr><th scope="col">Provider</th><th scope="col">Used for</th><th scope="col">What it can receive</th></tr></thead>
          <tbody>
            <tr><td>Vercel</td><td>Hosting, server functions, logs, AI gateway</td><td>Request data (IP, URLs), function logs, AI prompts when an AI feature is used</td></tr>
            <tr><td>Neon</td><td>Database (AWS US East)</td><td>Account, profile, favorites, messages, applications, reports, privacy requests</td></tr>
            <tr><td>Clerk</td><td>Sign-in and account identity</td><td>Name, email, sign-in identifiers, authentication records</td></tr>
            <tr><td>Mapbox</td><td>Interactive map, place search</td><td>Your IP address and device details, the map areas you view, and the place text you type into search</td></tr>
            <tr><td>OpenStreetMap Overpass</td><td>Nearby shelter lookup</td><td>Rounded search-area coordinates, requested by our servers (no account identifier)</td></tr>
            <tr><td>Ably</td><td>Realtime messaging</td><td>Message events and a pseudonymous account ID</td></tr>
            <tr><td>Resend</td><td>Account, appointment, and privacy-request email</td><td>Your email address and the message</td></tr>
            <tr><td>Daily</td><td>Optional video hellos</td><td>Display name, opaque participant ID, connection info, live audio/video you enable</td></tr>
            <tr><td>PostHog (US cloud)</td><td>Product analytics, only if you accept</td><td>See "Analytics, cookies, and maps"</td></tr>
            <tr><td>AI model providers, via Vercel AI Gateway and OpenRouter</td><td>Optional AI writing/intake features</td><td>The limited text needed for the task you start, after you consent</td></tr>
          </tbody>
        </table></div>
        <p>Pet and shelter information may also come from identified public or authorized sources, such as shelter websites, public datasets, and RescueGroups. Pet photos may load directly from the source shelter's or provider's servers, which then see your IP address.</p>
      </section>
      <section><h2 id="analytics">Analytics, cookies, and maps</h2>
        <ul><li><strong>Analytics are off until you say yes.</strong> Pawline uses PostHog to count page views and feature use (for example searches and favorites) so we can improve the service. We ask first. Until you choose "Allow analytics" in the banner, Pawline does not load PostHog and does not set its cookie or local-storage entries. If your browser sends Global Privacy Control or Do Not Track, we treat that as "No" automatically and do not ask. We keep this choice in your browser's local storage, and you can change it any time from "Privacy choices" in the footer or account menu.</li><li><strong>What PostHog gets if you say yes.</strong> Page paths (without query strings or fragments), a small set of named events (such as search, pet viewed, favorite added, application started or submitted), browser/OS/device type, referring site, and campaign tags. If you are signed in, an opaque account ID. We turn off autocapture, session recording, heatmaps, and IP-address enrichment.</li><li><strong>Strictly necessary storage.</strong> Clerk sets sign-in cookies (names starting with <code>__client</code>) so you can stay signed in. Pawline stores saved pets, your adopter profile draft, and tour choices in your browser's local storage so they work without an account. These are used only to run the feature you asked for.</li><li><strong>Maps.</strong> When a map loads, Mapbox receives your IP address and map usage data and sets its own local identifiers. Mapbox requires these requests to count map loads for billing and does not let us turn them off completely. We turn off Mapbox's optional performance metrics. See <a href="https://www.mapbox.com/legal/privacy" target="_blank" rel="noopener noreferrer">Mapbox's privacy policy</a>.</li><li><strong>Google Maps links.</strong> Directions links open Google Maps in a new tab only when you click them.</li></ul>
        <p><PrivacyChoicesLink label="Change your analytics choice" /></p>
      </section>
      <section><h2>Searches, lost-pet reports, and meetings</h2>
        <p>Saved searches are private to your account and may include location coordinates you choose to save. Lost-and-found reports publish the pet description, city or neighborhood, and date you supply; do not include an exact home address, contact information, or microchip identifier. Tips are visible only to the report owner. Open reports leave public search after 90 days, or when you mark them closed or reunited; this does not automatically delete their stored records or tips. Report flags help hide potentially abusive listings. Meeting proposals and confirmations are shared only with participants authorized for the associated conversation. Video media is not recorded by these meeting tools.</p>
      </section>
      <section><h2>AI-assisted features</h2>
        <p>AI-assisted writing or intake features require the applicable product consent and may be disabled. Pawline limits the task and information sent to configured providers, but you should not enter secrets, payment details, or unnecessary sensitive information.</p>
      </section>
      <section><h2>Appointments and video hellos</h2>
        <p>Appointment times, notes, confirmation status, and next steps are shared within the pet's private conversation with the adopter and authorized caregiver team. Optional appointment emails are sent through Resend to your verified account email; you can turn them off in the appointment. Calendar downloads contain the meeting time and pet name and are stored wherever you choose to import them.</p>
        <p>When video is available and you choose to join, Daily processes your display name, an opaque participant identifier, connection information, and live audio or video you enable. Pawline does not record or transcribe these calls. Pawline stores appointment history and may receive participant join and leave times from Daily for service reliability. Camera and microphone access are optional browser permissions. See <a href="https://www.daily.co/legal/privacy/" target="_blank" rel="noopener noreferrer">Daily's privacy policy</a> for its handling of service data.</p>
      </section>
      <section><h2>Retention, deletion, and choices</h2>
        <p>Retention varies by feature and safety obligation. Held application drafts are described in-product as private and scheduled for deletion after their hold period. You may avoid location sharing, decline optional AI features, decline analytics, remove favorites, or stop using account features. Shared records (such as a conversation or application involving another person or an organization) may be kept when deleting them would affect that other party or a legal or safety duty. To request access, correction, or deletion, <a href="/privacy/request">send a private privacy request</a> or email <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. Pawline verifies identity before disclosing or changing account data.</p>
      </section>
      <section><h2>Your California privacy rights</h2>
        <p>California residents can ask Pawline to: (1) tell you what personal information we collect, use, disclose, and keep; (2) give you a copy; (3) correct inaccurate information; (4) delete your information, subject to legal exceptions; and (5) limit use of sensitive personal information (we do not use it beyond running the service). You can also opt out of the sale or sharing of personal information; we do not sell or share it. We do not discriminate against you for making a request. We offer these rights to California residents whether or not Pawline is legally required to under the California Consumer Privacy Act as amended by the CPRA.</p>
        <p><strong>How to ask.</strong> Use the <a href="/privacy/request">privacy request form</a> or email <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. We verify requests by matching them to your signed-in account or verified email. You may use an authorized agent; we will ask for proof of their authority. We confirm receipt within 10 business days and respond within 45 days; if we need more time we may extend once by up to 45 days and tell you why. If we deny a request, we will explain why, and you may appeal by replying to our response.</p>
        <p><strong>Categories collected in the last 12 months, sources, and purposes.</strong></p>
        <div className="legal-table-wrap" role="region" aria-label="Personal information categories table" tabIndex={0}><table>
          <thead><tr><th scope="col">Category (CCPA)</th><th scope="col">Examples</th><th scope="col">Source</th><th scope="col">Purpose</th><th scope="col">Sold/shared</th></tr></thead>
          <tbody>
            <tr><td>Identifiers</td><td>Name, email, account ID, IP address</td><td>You, your device, Clerk</td><td>Run the service, security</td><td>No</td></tr>
            <tr><td>Customer records</td><td>Profile, household and pet-care answers in applications</td><td>You</td><td>Applications, messages, matching</td><td>No</td></tr>
            <tr><td>Geolocation</td><td>Search area; browser location if you allow it; saved coordinates</td><td>You, your device</td><td>Find nearby pets and resources</td><td>No</td></tr>
            <tr><td>Internet activity</td><td>Pages viewed, features used (only if you accept analytics)</td><td>Your device, PostHog</td><td>Improve the service</td><td>No</td></tr>
            <tr><td>Audio/video</td><td>Live video hello (not recorded)</td><td>You</td><td>Meeting you start</td><td>No</td></tr>
            <tr><td>Inferences</td><td>Match scores computed from facts you disclose</td><td>Pawline</td><td>Matching tools</td><td>No</td></tr>
          </tbody>
        </table></div>
        <p>Pawline does not knowingly collect sensitive personal information as defined by California law other than log-in credentials handled by Clerk and precise location you choose to share.</p>
        <p><strong>Global Privacy Control.</strong> We treat GPC and Do Not Track as a request to turn analytics off, as described above.</p>
        <p><strong>"Shine the Light."</strong> We do not disclose personal information to third parties for their own direct marketing.</p>
      </section>
      <section><h2>Children</h2>
        <p>Pawline is for people age 13 and older. We do not knowingly collect personal information from anyone under 13. If you are under 13, do not use Pawline accounts or send us information. If you believe a child under 13 has given us information, tell us at <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> and we will delete it. People under 18 should use Pawline only with a parent or guardian's permission.</p>
      </section>
      <section><h2>Security and changes</h2>
        <p>Pawline uses access controls and transport protections, but no online system can guarantee absolute security. If we make a material change to this policy we will update the effective date and, for material changes, tell you in the service or by email. Questions: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> or {LEGAL_ENTITY_DBA}, {LEGAL_ADDRESS}.</p>
      </section>
      <p className="methodology-related"><a href="/terms">Read the Terms of Use <span aria-hidden="true">→</span></a></p>
    </article>
  </main>;
}
