export const SEARCH_ORIGIN = "https://www.pawlineadopt.com";

export const searchResources = [
  { path: "/guides/questions-to-ask-before-adopting", title: "Questions to ask before adopting", description: "Bring a practical checklist to your shelter conversation." },
  { path: "/guides", title: "Adoption guides", description: "Practical guides for finding a pet and contacting the shelter." },
  { path: "/guides/find-adoptable-pets-near-you", title: "Find adoptable pets near you", description: "Search locally, understand listing sources, and confirm availability." },
  { path: "/guides/find-a-pet-that-fits-your-home-and-routine", title: "Find a pet that fits your home and routine", description: "Compare disclosed pet needs with your household and daily life." },
  { path: "/how-pawline-works", title: "How Pawline checks listing sources", description: "Understand provider listings, approximate leads, and unknown details." },
];

export function searchBreadcrumbs(title, path) {
  return [
    { name: "Pawline", path: "/" },
    ...(path.startsWith("/guides/") ? [{ name: "Adoption guides", path: "/guides" }] : []),
    { name: title, path },
  ];
}

export function searchPageSchema(title, path) {
  const url = `${SEARCH_ORIGIN}${path}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebPage", "@id": `${url}#webpage`, url, name: title, inLanguage: "en-US",
        isPartOf: { "@id": `${SEARCH_ORIGIN}/#website` },
        publisher: { "@id": `${SEARCH_ORIGIN}/#organization` },
        breadcrumb: { "@id": `${url}#breadcrumb` } },
      { "@type": "BreadcrumbList", "@id": `${url}#breadcrumb`,
        itemListElement: searchBreadcrumbs(title, path).map((crumb, index) => ({
          "@type": "ListItem", position: index + 1, name: crumb.name, item: `${SEARCH_ORIGIN}${crumb.path}`,
        })) },
    ],
  };
}
