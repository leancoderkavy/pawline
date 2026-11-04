import { searchMetadata } from "../../../src/resources/searchMetadata";
import { searchBreadcrumbs, SEARCH_ORIGIN, searchResources } from "../../../src/resources/searchCatalog";
import Content from "../../../src/resources/HowToAdoptADog";

const title = "How to adopt a dog";
const description = "Learn how to adopt a dog: confirm you're ready, search shelters and rescues, visit to ask questions, complete an application, prepare your home, and plan the first two weeks.";
const path = "/guides/how-to-adopt-a-dog";
export const metadata = searchMetadata(title, description, path);

const faqItems = [
  {
    question: "How much does it cost to adopt a dog?",
    answer: "Adoption fees vary by organization but typically range from $50 to $300 according to the ASPCA. Fees often include spaying or neutering, vaccinations, and microchipping. Contact the shelter or rescue directly to confirm their specific fees and what services are included."
  },
  {
    question: "How long does the dog adoption process take?",
    answer: "The timeline varies by organization and can range from a few days to several weeks. Some shelters allow same-day adoptions after an application and brief interview, while others require home visits, reference checks, and waiting periods. Ask the organization about their specific process when you first contact them."
  },
  {
    question: "What questions should I ask before adopting a dog?",
    answer: "Ask about the dog's availability, health records, behavior around children or other animals, daily routine, and any unknowns. Confirm the adoption requirements, fees, and next steps. Use a practical checklist to prepare for your shelter conversation."
  },
  {
    question: "Can I adopt a dog if I live in an apartment?",
    answer: "Yes, many dogs can thrive in apartments. Consider the dog's size, energy level, and exercise needs. Some landlords have pet policies or restrictions, so confirm your lease terms first. Shelters can help you find dogs suited to apartment living."
  },
  {
    question: "What do I need to prepare before bringing a dog home?",
    answer: "Essential items include food and water bowls, quality dog food, a collar with ID tags, a leash, a bed or crate, and toys. Prepare a designated area for your dog and remove hazards like toxic plants or small objects. Schedule a veterinary visit within the first week."
  },
  {
    question: "How do I know if I'm ready to adopt a dog?",
    answer: "Consider your daily schedule, living situation, budget, and long-term commitment. Dogs need time, attention, exercise, training, and veterinary care. Be honest about your routine and household when comparing available dogs. A shelter can help assess whether a specific dog fits your situation."
  },
];

const howToSteps = [
  { name: "Decide if you're ready for a dog", text: "Consider your daily schedule, living situation, and budget. Dogs need time, attention, exercise, training, and veterinary care throughout their lives." },
  { name: "Find adoptable dogs near you", text: "Search local animal shelters, rescue organizations, and adoption events. Check provider-backed listings and save the source URL and animal ID." },
  { name: "Visit and ask questions", text: "Contact the shelter to confirm availability and schedule a visit. Bring a list of questions about the dog's health, behavior, and care requirements." },
  { name: "Complete the application and home check", text: "Fill out the adoption application honestly and prepare for a potential home visit to ensure your living space is suitable." },
  { name: "Pay fees and complete paperwork", text: "Pay adoption fees, review and sign the contract, and collect the dog's medical records and vaccination history." },
  { name: "Prepare your home", text: "Gather essential supplies, remove hazards, secure your space, and establish a routine before bringing your dog home." },
  { name: "Plan for the first two weeks", text: "Keep your schedule predictable, be patient as your dog adjusts, and schedule a veterinary checkup within the first week." },
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
        datePublished: "2026-10-27",
        dateModified: "2026-10-27",
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
