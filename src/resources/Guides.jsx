

const guides = [
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
