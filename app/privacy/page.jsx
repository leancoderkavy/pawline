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
      <p className="methodology-kicker">Effective August 22, 2026</p>
      <h1>Privacy Policy</h1>
      <p className="methodology-lede">Pawline uses information only to provide pet-discovery, account, communication, application, safety, and service-reliability features. This page explains the current product behavior; it does not expand Pawline's rights to your information.</p>
      <section><h2>Information Pawline handles</h2><p>Public pages can receive ordinary request information such as IP address, browser details, requested pages, and approximate location derived from a search. If you create an account, Pawline receives identity details from Clerk and may store your profile preferences, favorites, messages, submissions, application drafts, consent choices, reports, and shelter-workspace activity.</p></section>
      <section><h2>How information is used</h2><p>Pawline uses this information to authenticate accounts, return relevant listings, synchronize saved work, support private product workflows, prevent abuse, investigate reports, enforce limits, and maintain the service. Pawline does not treat a match score as an adoption decision or sell personal information.</p></section>
      <section><h2>Service providers and public sources</h2><p>Pawline relies on providers for hosting, authentication, database storage, maps, realtime messaging, email, and narrowly enabled AI features. Pet and shelter information may also come from identified public or authorized sources. Providers process information under their own terms and Pawline's configuration of their services.</p></section>
      <section><h2>AI-assisted features</h2><p>AI-assisted writing or intake features require the applicable product consent and may be disabled. Pawline limits the task and information sent to configured providers, but you should not enter secrets, payment details, or unnecessary sensitive information.</p></section>
      <section><h2>Retention, deletion, and choices</h2><p>Retention varies by feature and safety obligation. Held application drafts are described in-product as private and scheduled for deletion after their hold period. You may avoid location sharing, decline optional AI features, remove favorites, or stop using account features. To request access, correction, or deletion, <a href="https://github.com/leancoderkavy/pawline/issues">contact Pawline through its public support tracker</a> without including sensitive information.</p></section>
      <section><h2>Security and changes</h2><p>Pawline uses access controls and transport protections, but no online system can guarantee absolute security. Material changes to this policy will be reflected by a new effective date on this page.</p></section>
      <p className="methodology-related"><a href="/terms">Read the Terms of Use <span aria-hidden="true">→</span></a></p>
    </article>
  </main>;
}
