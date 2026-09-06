export default function SearchPage({ title, path, children }) {
  const url = `https://www.pawlineadopt.com${path}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: title,
    inLanguage: "en-US",
    isPartOf: { "@id": "https://www.pawlineadopt.com/#website" },
    publisher: { "@id": "https://www.pawlineadopt.com/#organization" },
  };
  return <>
    <nav className="search-page-nav" aria-label="Pawline navigation">
      <a href="/#map">Pawline adoption map</a>
      <a href="/guides">Adoption guides</a>
    </nav>
    <main>{children}</main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
  </>;
}
