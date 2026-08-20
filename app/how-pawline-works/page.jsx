const canonicalUrl = "https://www.pawlineadopt.com/how-pawline-works";

export const metadata = {
  title: "How Pawline Finds and Verifies Adoptable Pets",
  description: "Learn how Pawline distinguishes current shelter listings, reviewed adoption events, community submissions, and approximate web leads before you contact a shelter.",
  alternates: { canonical: "/how-pawline-works" },
  openGraph: {
    title: "How Pawline Finds and Verifies Adoptable Pets",
    description: "A transparent guide to Pawline's adoption listing sources, review states, and matching tools.",
    url: "/how-pawline-works",
    images: [{ url: "/social-card.png", width: 1200, height: 630, alt: "Pawline pet adoption map and paw-print logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How Pawline Finds and Verifies Adoptable Pets",
    description: "A transparent guide to Pawline's adoption listing sources, review states, and matching tools.",
    images: [{ url: "/social-card.png", alt: "Pawline pet adoption map and paw-print logo" }],
  },
};

const recordTypes = [
  ["Provider-backed pet listings", "Current records from official public shelter feeds, authorized providers, or reviewed Pawline records. When a source provides a public listing URL, Pawline links back to it."],
  ["Reviewed adoption events", "Upcoming events with an identified organizer and a source link, shown separately from pet listings."],
  ["Moderated community submissions", "Records submitted to Pawline that remain private until they have been reviewed."],
  ["Approximate web leads", "Search-discovered leads that may help someone locate a shelter or adoption resource. They are clearly labeled and are never presented as shelter-verified animals."],
];

export default function HowPawlineWorksPage() {
  return <main className="methodology-page">
    <header className="methodology-header">
      <a className="methodology-brand" href="/" aria-label="Pawline adoption discovery home">Pawline</a>
      <div className="methodology-header-actions">
        <a className="methodology-nav" href="/guides"><span className="methodology-nav-long">Adoption guides</span><span className="methodology-nav-short">Guides</span></a>
        <a className="methodology-discover" href="/"><span className="methodology-discover-long">Find adoptable pets</span><span className="methodology-discover-short">Find pets</span> <span aria-hidden="true">→</span></a>
      </div>
    </header>

    <article className="methodology-content">
      <p className="methodology-kicker">Our listing and matching approach</p>
      <h1>How Pawline helps you find adoptable pets</h1>
      <p className="methodology-lede">Pawline is an adoption discovery service. We help people find current pet listings, reviewed events, and local adoption resources, then direct them to the shelter or organizer for the final details and adoption process.</p>

      <section aria-labelledby="record-types-heading">
        <h2 id="record-types-heading">What each Pawline record means</h2>
        <div className="methodology-records">
          {recordTypes.map(([title, description]) => <section key={title}>
            <h3>{title}</h3>
            <p>{description}</p>
          </section>)}
        </div>
      </section>

      <section aria-labelledby="availability-heading">
        <h2 id="availability-heading">Availability is always confirmed with the source</h2>
        <p>Pet availability, fees, medical information, behavior, and adoption requirements can change quickly. Pawline does not infer those details or call a missing listing adopted. Before visiting or applying, open the original shelter or rescue listing and confirm the current status directly with that organization.</p>
      </section>

      <section aria-labelledby="matching-heading">
        <h2 id="matching-heading">How the match quiz works</h2>
        <p>The standard Pawline match quiz ranks records using the home, routine, household, and pet-experience details a person shares alongside the listing facts that are actually available. It shows supporting facts, potential conflicts, and questions to ask when information is missing. A match score is an aid for comparing records; it is not an adoption decision, safety assessment, or compatibility guarantee.</p>
      </section>

      <section aria-labelledby="location-heading">
        <h2 id="location-heading">Finding pets near you</h2>
        <p>Search by city, address, or postal code to explore the locations covered by Pawline's current provider feeds and reviewed records. Coverage and source availability can vary by location, so Pawline shows loading, partial, unavailable, and error states instead of replacing missing live data with synthetic pets.</p>
      </section>

      <section className="methodology-next" aria-labelledby="next-heading">
        <h2 id="next-heading">Ready to start?</h2>
        <p>Explore current listings on the Pawline map, then use the original shelter or rescue link to take the next step.</p>
        <a href="/">Explore adoptable pets <span aria-hidden="true">→</span></a>
      </section>

      <p className="methodology-related"><a href="/guides/find-a-pet-that-fits-your-home-and-routine">Read: How to find a pet that fits your home and routine <span aria-hidden="true">→</span></a></p>
    </article>

    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: "How Pawline Finds and Verifies Adoptable Pets",
      description: "A transparent guide to Pawline's adoption listing sources, review states, and matching tools.",
      isPartOf: { "@id": "https://www.pawlineadopt.com/#website" },
      about: { "@type": "Thing", name: "Pet adoption discovery" },
      inLanguage: "en-US",
    }).replace(/</g, "\\u003c") }} />
  </main>;
}
