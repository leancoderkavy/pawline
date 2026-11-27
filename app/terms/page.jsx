import { LEGAL_ADDRESS, LEGAL_EFFECTIVE_DATE, LEGAL_EMAIL, LEGAL_ENTITY, LEGAL_ENTITY_DBA, LEGAL_ENTITY_DESCRIPTION, PRIVACY_EMAIL } from "../../src/legalEntity.js";

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
      <p className="methodology-kicker">Effective {LEGAL_EFFECTIVE_DATE}</p>
      <h1>Terms of Use</h1>
      <p className="methodology-lede">Pawline is a discovery and workflow service. It is not a shelter, rescue, veterinarian, adoption agency, emergency service, or guarantor of any listing, animal, organization, match, or outcome.</p>
      <section><h2>Who we are</h2>
        <p>These Terms are an agreement between you and <strong>{LEGAL_ENTITY}, {LEGAL_ENTITY_DESCRIPTION}</strong> ("Pawline," "we," "us"), {LEGAL_ADDRESS}. Pawline Adopt, at pawlineadopt.com, is a pet-adoption discovery service. It is not related to any other company or product called "Pawline," including pet-health services. By using Pawline you agree to these Terms and to our <a href="/privacy">Privacy Policy</a>. If you do not agree, do not use Pawline.</p>
      </section>
      <section><h2>Verify information with the source</h2>
        <p>Listings, availability, fees, health, behavior, location, hours, eligibility, and adoption requirements can change. Approximate web leads are not verified listings. Confirm material information with the identified shelter, rescue, organizer, or original source before relying on it.</p>
      </section>
      <section><h2>Accounts and acceptable use</h2>
        <p>Pawline accounts are for people age 13 or older. Do not create an account if you are under 13. If you are under 18, use Pawline only with a parent or guardian's permission. Provide accurate account information, protect your credentials, and use Pawline only lawfully. Do not impersonate others, scrape or disrupt the service, bypass access controls or rate limits, submit deceptive listings, expose private information, harass users, facilitate unsafe meetings, or request payment through Pawline messaging. We may suspend or end access if you break these Terms or if needed to protect people, animals, or the service. You may stop using Pawline at any time and may ask us to delete your account through the <a href="/privacy/request">privacy request form</a> or at <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.</p>
      </section>
      <section><h2>Submissions, messages, and applications</h2>
        <p>You are responsible for content you submit and must have the right to share it. You keep ownership of your content. You give Pawline a worldwide, non-exclusive, royalty-free license to host, store, display, and process it to run Pawline, to show it to the people or organizations you choose, and to the public where you post publicly (for example lost-and-found reports and community posts). Pawline may validate, moderate, limit, reject, retain, or remove content to operate safely. Saving or submitting an application does not guarantee that an organization participates, receives it, responds, or approves an adoption.</p>
      </section>
      <section><h2>Reports and copyright</h2>
        <p>Report problem listings, messages, or users in the app or at <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>. For a copyright complaint, email <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a> with "Copyright notice" in the subject and identify the work, where it appears on Pawline, and how to reach you. We may remove content and end access for repeat infringers.</p>
      </section>
      <section><h2>Matching and AI assistance</h2>
        <p>Matching tools organize disclosed facts and questions; they are not professional advice, safety assessments, or compatibility guarantees. AI-assisted text must be reviewed for accuracy before use. Do not rely on generated text as a substitute for your own truthful answers or professional judgment.</p>
      </section>
      <section><h2>Third-party services</h2>
        <p>Pawline links to and depends on third-party providers and public sources. Their services, content, availability, privacy practices, and terms are outside Pawline's control. Following a link does not constitute an endorsement or guarantee.</p>
      </section>
      <section><h2>Pawline is free</h2>
        <p>Pawline is currently free. If we add paid features, we will show the price and renewal terms before you pay.</p>
      </section>
      <section><h2>Availability and responsibility</h2>
        <p>Pawline is provided "as is" and "as available" and may change, pause, or stop. To the extent the law allows, we make no warranties of any kind, including about the accuracy of listings, the availability or condition of any animal, or fitness for a particular purpose. To the extent the law allows, Pawline is not responsible for decisions, transactions, injuries, losses, disputes, or outcomes involving users, animals, organizations, listings, or third-party services, and our total liability for any claim relating to Pawline is limited to US$100. We are not liable for indirect, incidental, special, consequential, or punitive damages. Some places do not allow these limits, so they may not apply to you. Nothing in these Terms limits liability that cannot legally be limited, and your non-waivable rights are unaffected.</p>
      </section>
      <section><h2>Governing law and disputes</h2>
        <p>These Terms are governed by California law, without regard to conflict-of-law rules. Before filing a claim, send a written description of the dispute to <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a> (or the mailing address above) and allow 30 days to try to resolve it. A dispute that isn't resolved will be brought in the state or federal courts located in Los Angeles County, California, and you and we consent to those courts, except that either of us may bring an individual claim in small-claims court in the county where you live.</p>
      </section>
      <section><h2>Changes and contact</h2>
        <p>We may update these Terms. If a change is material, we will say so on this page and in the service or by email before it takes effect, and we will update the effective date. Using Pawline after the effective date means you accept the updated Terms. Questions or legal notices: {LEGAL_ENTITY_DBA}, {LEGAL_ADDRESS}, <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>. These Terms, with the Privacy Policy, are the entire agreement between you and Pawline about the service; if a provision is unenforceable the rest stays in effect.</p>
      </section>
      <p className="methodology-related"><a href="/privacy">Read the Privacy Policy <span aria-hidden="true">→</span></a></p>
    </article>
  </main>;
}
