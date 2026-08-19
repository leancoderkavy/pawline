const canonicalUrl = "https://www.pawlineadopt.com/guides";

export const metadata = {
  title: "Pet Adoption Guides | Pawline",
  description: "Practical Pawline guides for finding current adoptable dogs and cats, understanding listing status, and confirming details with shelters.",
  alternates: { canonical: "/guides" },
  openGraph: {
    title: "Pet Adoption Guides | Pawline",
    description: "Practical guides for finding current adoptable pets and understanding listing status.",
    url: "/guides",
    images: [{ url: "/social-card.png", width: 1200, height: 630, alt: "Pawline pet adoption map and paw-print logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pet Adoption Guides | Pawline",
    description: "Practical guides for finding current adoptable pets and understanding listing status.",
    images: [{ url: "/social-card.png", alt: "Pawline pet adoption map and paw-print logo" }],
  },
};

const guides = [
  {
    href: "/guides/find-adoptable-pets-near-you",
    label: "Start your search",
    title: "How to find adoptable dogs and cats near you",
    description: "Use a current location, read the record class, and confirm the original source before you make plans.",
  },
  {
    href: "/how-pawline-works",
    label: "Understand the data",
    title: "How Pawline verifies adoption listings",
    description: "Learn the difference between provider-backed listings, reviewed events, community submissions, and approximate web leads.",
  },
];

export default function AdoptionGuidesPage() {
  return <main className="methodology-page guides-page">
    <header className="methodology-header">
      <a className="methodology-brand" href="/" aria-label="Pawline adoption discovery home">Pawline</a>
      <div className="methodology-header-actions">
        <a className="methodology-nav" href="/how-pawline-works">How Pawline works</a>
        <a className="methodology-discover" href="/">Find adoptable pets <span aria-hidden="true">→</span></a>
      </div>
    </header>

    <article className="methodology-content">
      <p className="methodology-kicker">Pawline adoption guides</p>
      <h1>Clearer steps for finding an adoptable pet</h1>
      <p className="methodology-lede">These guides explain how to use Pawline's current listing search, what the different record types mean, and when to go directly to a shelter or rescue for the final answer.</p>

      <section aria-labelledby="guides-heading">
        <h2 id="guides-heading">Start with the question you have now</h2>
        <div className="guide-list">
          {guides.map((guide) => <a className="guide-card" href={guide.href} key={guide.href}>
            <span>{guide.label}</span>
            <h3>{guide.title}</h3>
            <p>{guide.description}</p>
            <strong>Read the guide <i aria-hidden="true">→</i></strong>
          </a>)}
        </div>
      </section>

      <section className="methodology-next" aria-labelledby="guides-next-heading">
        <h2 id="guides-next-heading">Search current listings</h2>
        <p>When you are ready to explore, use the Pawline map and open the source listing to confirm availability with the shelter or rescue.</p>
        <a href="/">Explore adoptable pets <span aria-hidden="true">→</span></a>
      </section>
    </article>

    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: "Pawline Pet Adoption Guides",
      description: "Practical Pawline guides for finding current adoptable dogs and cats and understanding listing status.",
      isPartOf: { "@id": "https://www.pawlineadopt.com/#website" },
      inLanguage: "en-US",
      mainEntity: {
        "@type": "ItemList",
        itemListElement: guides.map((guide, position) => ({
          "@type": "ListItem",
          position: position + 1,
          url: `https://www.pawlineadopt.com${guide.href}`,
          name: guide.title,
        })),
      },
    }).replace(/</g, "\\u003c") }} />
  </main>;
}
