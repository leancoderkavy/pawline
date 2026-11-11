import { searchMetadata } from "./searchMetadata";
import { searchBreadcrumbs, SEARCH_ORIGIN, searchResources } from "./searchCatalog";

export { searchMetadata };

export function buildGuideArticleSchema({
  title,
  description,
  path,
  faqItems = [],
  howToSteps = [],
  datePublished,
  dateModified,
}) {
  const url = `${SEARCH_ORIGIN}${path}`;
  const resource = searchResources.find(item => item.path === path);
  const graph = [
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: title,
      inLanguage: "en-US",
      description: resource?.description || description,
      isPartOf: { "@id": `${SEARCH_ORIGIN}/#website` },
      publisher: { "@id": `${SEARCH_ORIGIN}/#organization` },
      breadcrumb: { "@id": `${url}#breadcrumb` },
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: searchBreadcrumbs(title, path).map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.name,
        item: `${SEARCH_ORIGIN}${crumb.path}`,
      })),
    },
    {
      "@type": "Article",
      "@id": `${url}#article`,
      headline: title,
      description,
      datePublished,
      dateModified: dateModified || datePublished,
      author: { "@id": `${SEARCH_ORIGIN}/#organization` },
      publisher: { "@id": `${SEARCH_ORIGIN}/#organization` },
      inLanguage: "en-US",
      mainEntityOfPage: { "@id": `${url}#webpage` },
    },
  ];

  if (howToSteps.length) {
    graph.push({
      "@type": "HowTo",
      "@id": `${url}#howto`,
      name: title,
      description,
      inLanguage: "en-US",
      step: howToSteps.map((step, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: step.name,
        text: step.text,
      })),
    });
  }

  if (faqItems.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: faqItems.map(item => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

export default function GuideArticlePage({
  title,
  description,
  path,
  faqItems = [],
  howToSteps = [],
  datePublished,
  dateModified,
  children,
}) {
  const crumbs = searchBreadcrumbs(title, path);
  const schema = buildGuideArticleSchema({
    title,
    description,
    path,
    faqItems,
    howToSteps,
    datePublished,
    dateModified,
  });
  const resource = searchResources.find(item => item.path === path);

  return <>
    <a className="search-skip" href="#guide-content">Skip to guide content</a>
    <nav className="search-page-nav" aria-label="Pawline navigation">
      <a href="/#map">Pawline adoption map</a>
      <a href="/guides">Adoption guides</a>
    </nav>
    <main>
      <nav className="search-breadcrumbs" aria-label="Breadcrumb">
        <ol>{crumbs.map((crumb, index) => <li key={crumb.path}>
          {index === crumbs.length - 1 ? <span aria-current="page">{crumb.name}</span> : <a href={crumb.path}>{crumb.name}</a>}
        </li>)}</ol>
      </nav>
      {resource && <p className="search-breadcrumbs">{resource.description}</p>}
      <div id="guide-content" tabIndex={-1}>{children}</div>
      <aside className="search-related" aria-label="Related adoption guides">
        <h2>Keep planning your adoption</h2>
        <ul>{searchResources.filter(item => item.path !== path && item.path !== "/guides").map(item =>
          <li key={item.path}><a href={item.path}>{item.title}</a><p>{item.description}</p></li>)}
        </ul>
      </aside>
    </main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
  </>;
}
