export const SEARCH_ORIGIN = "https://www.pawlineadopt.com";

export const searchResources = [
  { path: "/events", title: "Pet adoption and community events", description: "Explore upcoming pet events and confirm details with the organizer." },
  { path: "/guides/questions-to-ask-before-adopting", title: "Questions to ask before adopting", description: "Bring a practical checklist to your shelter conversation." },
  { path: "/guides", title: "Adoption guides", description: "Practical guides for finding a pet and contacting the shelter." },
  { path: "/guides/find-adoptable-pets-near-you", title: "Find adoptable pets near you", description: "Search locally, understand listing sources, and confirm availability." },
  { path: "/guides/find-a-pet-that-fits-your-home-and-routine", title: "Find a pet that fits your home and routine", description: "Compare disclosed pet needs with your household and daily life." },
  { path: "/guides/how-to-adopt-a-dog", title: "How to adopt a dog", description: "Step-by-step guidance from deciding readiness to preparing your home and the first two weeks." },
  { path: "/guides/first-time-dog-owner-checklist", title: "First time dog owner checklist", description: "Confirm you're ready, choose the right dog, prepare supplies and your home, and plan for the first weeks." },
  { path: "/guides/adopt-a-pet-before-the-holidays", title: "Adopt a pet before the holidays", description: "Decide whether a pre-holiday adoption fits your calendar, guests, and travel plans." },
  { path: "/guides/adopting-a-pet-as-a-gift", title: "Adopting a pet as a gift responsibly", description: "Consent-first guidance for pets as gifts and better holiday alternatives." },
  { path: "/guides/winter-pet-care-for-newly-adopted-pets", title: "Winter pet care for newly adopted pets", description: "Cold-weather routines, hazards, and follow-up care after a new adoption." },
  { path: "/guides/adopt-a-pet-after-the-holidays", title: "Adopt a pet after the holidays", description: "Why a calmer January adoption window can help households and pets settle in." },
  { path: "/guides/holiday-travel-and-pet-adoption-timing", title: "Holiday travel and pet adoption timing", description: "Time adoption around travel so a new pet gets a stable settling-in period." },
  { path: "/guides/adopt-a-cat-during-the-holidays", title: "Adopt a cat during the holidays", description: "Holiday cat adoption tips, décor hazards, and quiet introductions." },
  { path: "/guides/prepare-your-home-for-a-winter-adoption", title: "Prepare your home for a winter adoption", description: "Set up supplies, a quiet arrival zone, and winter hazard controls before pickup." },
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
        description: searchResources.find(resource => resource.path === path)?.description,
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
