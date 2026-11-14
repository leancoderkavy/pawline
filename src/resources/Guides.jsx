

const guides = [
  {
    href: "#guides/how-to-adopt", path: "/guides/how-to-adopt-a-dog",
    label: "Complete adoption guide",
    title: "How to adopt a dog",
    description: "Step-by-step guidance from deciding readiness to preparing your home and planning the first two weeks.",
  },
  {
    href: "#guides/first-time", path: "/guides/first-time-dog-owner-checklist",
    label: "First-time owner guide",
    title: "First time dog owner checklist",
    description: "Confirm you're ready, choose the right dog, prepare essential supplies and your home, and plan for the first weeks.",
  },
  {
    href: "#guides/checklist", path: "/guides/questions-to-ask-before-adopting",
    label: "Prepare for a conversation",
    title: "Questions to ask a shelter before adopting a pet",
    description: "Confirm availability, meeting arrangements, household needs, and the next step with a practical checklist.",
  },
  {
    href: "#guides/nearby", path: "/guides/find-adoptable-pets-near-you",
    label: "Start your search",
    title: "How to find adoptable dogs and cats near you",
    description: "Use a current location, read the record class, and confirm the original source before you make plans.",
  },
  {
    href: "#guides/matching", path: "/guides/find-a-pet-that-fits-your-home-and-routine",
    label: "Compare your options",
    title: "How to find a pet that fits your home and routine",
    description: "Use disclosed listing facts and your household, routine, and pet experience to compare questions worth asking a shelter.",
  },
  {
    href: "/guides/adopt-a-pet-before-the-holidays", path: "/guides/adopt-a-pet-before-the-holidays",
    label: "Holiday timing",
    title: "How to adopt a pet before the holidays",
    description: "Decide whether a pre-holiday adoption fits guests, travel, and the settling-in time a new pet needs.",
  },
  {
    href: "/guides/adopting-a-pet-as-a-gift", path: "/guides/adopting-a-pet-as-a-gift",
    label: "Responsible gifting",
    title: "Adopting a pet as a gift—responsibly",
    description: "Consent-first guidance when someone wants to include adoption in a holiday gift plan.",
  },
  {
    href: "/guides/winter-pet-care-for-newly-adopted-pets", path: "/guides/winter-pet-care-for-newly-adopted-pets",
    label: "Winter care",
    title: "Winter pet care for newly adopted dogs and cats",
    description: "Cold-weather routines, indoor safety, and seasonal hazards after a new adoption.",
  },
  {
    href: "/guides/adopt-a-pet-after-the-holidays", path: "/guides/adopt-a-pet-after-the-holidays",
    label: "After the rush",
    title: "Why adopt a pet after the holidays",
    description: "Use a calmer January window while you keep searching current shelter listings.",
  },
  {
    href: "/guides/holiday-travel-and-pet-adoption-timing", path: "/guides/holiday-travel-and-pet-adoption-timing",
    label: "Travel timing",
    title: "Holiday travel and pet adoption timing",
    description: "Align pickup with days you can stay home so a new pet can settle without a rushed trip.",
  },
  {
    href: "/guides/adopt-a-cat-during-the-holidays", path: "/guides/adopt-a-cat-during-the-holidays",
    label: "Cat adoption",
    title: "How to adopt a cat during the holidays",
    description: "Quiet landing rooms, lily- and tinsel-safe décor, and confirmed shelter listings.",
  },
  {
    href: "/guides/prepare-your-home-for-a-winter-adoption", path: "/guides/prepare-your-home-for-a-winter-adoption",
    label: "Home setup",
    title: "Prepare your home for a winter pet adoption",
    description: "Arrival zones, core supplies, and winter hazard controls before bring-home day.",
  },
  {
    href: "#how-pawline-works", path: "/how-pawline-works",
    label: "Understand the data",
    title: "How Pawline verifies adoption listings",
    description: "Learn the difference between provider-backed listings, reviewed events, community submissions, and approximate web leads.",
  },
];

export default function AdoptionGuidesPage({ standalone = false }) {
  return <section className="methodology-page guides-page">
<article className="methodology-content">
      <p className="methodology-kicker">Pawline adoption guides</p>
      <h1>Clearer steps for finding an adoptable pet</h1>
      <p className="methodology-lede">These guides explain how to use Pawline's current listing search, what the different record types mean, and when to go directly to a shelter or rescue for the final answer.</p>

      <section aria-labelledby="guides-heading">
        <h2 id="guides-heading">Start with the question you have now</h2>
        <div className="guide-list">
          {guides.map((guide) => <a className="guide-card" href={standalone ? guide.path : guide.href} key={guide.href}>
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
        <a href={standalone ? "/#map" : "#map"}>Explore adoptable pets <span aria-hidden="true">→</span></a>
      </section>
    </article>


  </section>;
}
