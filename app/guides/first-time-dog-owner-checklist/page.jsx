import { searchMetadata } from "../../../src/resources/searchMetadata";
import { searchBreadcrumbs, SEARCH_ORIGIN, searchResources } from "../../../src/resources/searchCatalog";
import Content from "../../../src/resources/FirstTimeDogOwnerChecklist";

const title = "First time dog owner checklist";
const description = "Use this first-time dog owner checklist to confirm you're ready for the commitment, choose the right dog, prepare your home and supplies, and plan for the first weeks with your new companion.";
const path = "/guides/first-time-dog-owner-checklist";
export const metadata = searchMetadata(title, description, path);

const faqItems = [
  {
    question: "What supplies do I need before getting a dog?",
    answer: "Essential supplies include food and water bowls, quality dog food, a collar with ID tags, a leash, a comfortable bed or crate, safe chew toys, grooming supplies, and cleaning materials. Have these ready before bringing your dog home."
  },
  {
    question: "How much does it cost to own a dog in the first year?",
    answer: "First-year costs typically range from $1,000 to $2,000 according to the ASPCA. This includes adoption fees, initial veterinary care (spaying/neutering, vaccinations, microchip), supplies, food, training, and preventive medications. Budget for ongoing annual costs of $500 to $1,000 for food, routine care, and supplies."
  },
  {
    question: "How much time does a dog need each day?",
    answer: "Most dogs need at least 1-2 hours of active attention daily, including walks, playtime, training, grooming, and companionship. Puppies and high-energy breeds may need more. Consider your daily schedule before adopting."
  },
  {
    question: "What training should I plan for a new dog?",
    answer: "Basic obedience training (sit, stay, come, down, leash walking) is essential for all dogs. House training is critical if adopting a puppy or untrained adult. Consider enrolling in a positive reinforcement training class within the first few weeks. Consistent daily training sessions of 5-10 minutes work well."
  },
  {
    question: "How do I find a good veterinarian?",
    answer: "Ask for recommendations from local shelters, pet owners, or online reviews. Schedule a new patient visit before adopting if possible, or within the first week after bringing your dog home. Confirm the clinic's hours, emergency coverage, and services offered."
  },
  {
    question: "Can I adopt a dog if I work full time?",
    answer: "Yes, many people successfully adopt dogs while working full time. Choose a dog whose energy level and needs match your schedule. Plan for exercise before and after work, consider a dog walker or daycare for midday breaks, and ensure your dog has mental stimulation while you're away."
  },
];

const howToSteps = [
  { name: "Assess your readiness", text: "Confirm you have the time, budget, living situation, and long-term commitment for dog ownership before adopting." },
  { name: "Choose the right first dog", text: "Consider age, size, energy level, temperament, and health needs. Adult dogs are often easier for first-time owners than puppies." },
  { name: "Gather essential supplies", text: "Purchase food, bowls, collar, leash, ID tags, bed, toys, grooming supplies, and cleaning materials before bringing your dog home." },
  { name: "Prepare your home", text: "Remove hazards, secure outdoor spaces, designate a dog area, and plan a consistent potty routine." },
  { name: "Build your support network", text: "Find a veterinarian, identify a trainer, arrange backup care, and connect with other dog owners for advice and support." },
  { name: "Plan the first weeks", text: "Establish routines immediately, be patient with house training, limit overwhelming introductions, start training early, and schedule a vet visit within the first week." },
];

function customSchema() {
  const url = `${SEARCH_ORIGIN}${path}`;
  const resource = searchResources.find(item => item.path === path);
  
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: title,
        inLanguage: "en-US",
        description: resource?.description || description,
        isPartOf: { "@id": `${SEARCH_ORIGIN}/#website` },
        publisher: { "@id": `${SEARCH_ORIGIN}/#organization` },
        breadcrumb: { "@id": `${url}#breadcrumb` }
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: searchBreadcrumbs(title, path).map((crumb, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: crumb.name,
          item: `${SEARCH_ORIGIN}${crumb.path}`,
        }))
      },
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: title,
        description: description,
        datePublished: "2026-10-30",
        dateModified: "2026-10-30",
        author: { "@id": `${SEARCH_ORIGIN}/#organization` },
        publisher: { "@id": `${SEARCH_ORIGIN}/#organization` },
        inLanguage: "en-US",
        mainEntityOfPage: { "@id": `${url}#webpage` }
      },
      {
        "@type": "HowTo",
        "@id": `${url}#howto`,
        name: title,
        description: description,
        inLanguage: "en-US",
        step: howToSteps.map((step, index) => ({
          "@type": "HowToStep",
          position: index + 1,
          name: step.name,
          text: step.text
        }))
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: faqItems.map(item => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer
          }
        }))
      }
    ]
  };
}

export default function Page() {
  const crumbs = searchBreadcrumbs(title, path);
  const schema = customSchema();
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
      <div id="guide-content" tabIndex={-1}><Content standalone /></div>
      <aside className="search-related" aria-label="Related adoption guides">
        <h2>Keep planning your adoption</h2>
        <ul>{searchResources.filter(resource => resource.path !== path && resource.path !== "/guides").map(resource =>
          <li key={resource.path}><a href={resource.path}>{resource.title}</a><p>{resource.description}</p></li>)}
        </ul>
      </aside>
    </main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
  </>;
}
