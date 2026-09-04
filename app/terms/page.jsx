export const metadata = {
  title: "Terms of Use",
  description: "Terms governing Pawline's pet-adoption discovery, account, messaging, submission, and application tools.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return <main className="methodology-page">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="methodology-header"><a className="methodology-brand" href="/">Pawline</a><a className="methodology-discover" href="/">Find adoptable pets <span aria-hidden="true">→</span></a></header>
    <article id="main-content" className="methodology-content legal-content" tabIndex={-1}>
      <p className="methodology-kicker">Effective August 22, 2026</p>
      <h1>Terms of Use</h1>
      <p className="methodology-lede">Pawline is a discovery and workflow service. It is not a shelter, rescue, veterinarian, adoption agency, emergency service, or guarantor of any listing, animal, organization, match, or outcome.</p>
      <section><h2>Verify information with the source</h2><p>Listings, availability, fees, health, behavior, location, hours, eligibility, and adoption requirements can change. Approximate web leads are not verified listings. Confirm material information with the identified shelter, rescue, organizer, or original source before relying on it.</p></section>
      <section><h2>Accounts and acceptable use</h2><p>Provide accurate account information, protect your credentials, and use Pawline only lawfully. Do not impersonate others, scrape or disrupt the service, bypass access controls, submit deceptive listings, expose private information, harass users, facilitate unsafe meetings, or request payment through Pawline messaging.</p></section>
      <section><h2>Submissions, messages, and applications</h2><p>You are responsible for content you submit and must have the right to share it. Pawline may validate, moderate, limit, reject, retain, or remove content to operate safely. Saving or submitting an application does not guarantee that an organization participates, receives it, responds, or approves an adoption.</p></section>
      <section><h2>Matching and AI assistance</h2><p>Matching tools organize disclosed facts and questions; they are not professional advice, safety assessments, or compatibility guarantees. AI-assisted text must be reviewed for accuracy before use. Do not rely on generated text as a substitute for your own truthful answers or professional judgment.</p></section>
      <section><h2>Third-party services</h2><p>Pawline links to and depends on third-party providers and public sources. Their services, content, availability, privacy practices, and terms are outside Pawline's control. Following a link does not constitute an endorsement or guarantee.</p></section>
      <section><h2>Availability and responsibility</h2><p>The service is provided as available and may change, pause, or stop. To the extent permitted by law, Pawline is not responsible for decisions, transactions, injuries, losses, disputes, or outcomes involving users, animals, organizations, listings, or third-party services. Rights that cannot legally be limited remain unaffected.</p></section>
      <p className="methodology-related"><a href="/privacy">Read the Privacy Policy <span aria-hidden="true">→</span></a></p>
    </article>
  </main>;
}
