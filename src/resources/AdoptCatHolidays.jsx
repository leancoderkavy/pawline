export const faqItems = [
  {
    question: "Is the holiday season a good time to adopt a cat?",
    answer: "It can be, if you can keep the home relatively calm, secure windows and decorations, and give the cat a private room to decompress. If parties and travel dominate your calendar, wait until after the holidays while you continue browsing listings."
  },
  {
    question: "Should I adopt a kitten as a holiday surprise?",
    answer: "Surprise kitten adoptions are risky. Kittens need supervised care, veterinary follow-up, and a prepared home. The caregiver should consent and complete the shelter or rescue process. Consider adopting after celebrations or gifting a planned search instead."
  },
  {
    question: "What holiday hazards are especially dangerous for cats?",
    answer: "Lilies and many floral arrangements are highly toxic to cats. Tinsel, ribbons, string, candles, and some foods also pose risks. Secure decorations and keep trash closed."
  },
  {
    question: "How do I find adoptable cats on Pawline Adopt?",
    answer: "Open the map at pawlineadopt.com, search near a location you can visit, filter or browse cat listings where available, and open the original shelter or rescue page to confirm status. Pawline Adopt is a pet adoption discovery service—not a pet-health product."
  },
];

export const howToSteps = [
  { name: "Prepare a quiet landing room", text: "Set up litter, food, water, hiding spots, and vertical space before the cat arrives." },
  { name: "Cat-proof holiday decorations", text: "Remove or secure lilies, tinsel, ribbons, and fragile ornaments; block unsafe hiding places." },
  { name: "Search current cat listings", text: "Use the Pawline Adopt map and confirm each cat on the organization's own listing page." },
  { name: "Ask about personality and unknowns", text: "Confirm what is known about children, other pets, medical needs, and indoor preferences." },
  { name: "Introduce the home gradually", text: "Start in one room, keep guest access limited at first, and expand space as the cat gains confidence." },
];

export default function AdoptCatHolidays({ standalone = false }) {
  return <section className="methodology-page guide-page"><article className="methodology-content">
    <p className="methodology-kicker">Cat adoption guide</p>
    <h1>How to adopt a cat during the holidays</h1>
    <p className="methodology-lede">Holiday cat adoptions succeed when the home is secure, the caregiver is ready, and the first days are quiet. Browse current shelter listings, confirm details with the organization, and protect cats from seasonal hazards.</p>
    <p>Prepared by <strong>Pawline Adopt</strong> (pawlineadopt.com) · Reviewed <time dateTime="2026-11-16">November 16, 2026</time></p>
    <p className="guide-note">If you searched for &quot;Pawline&quot; and expected pet health tools, you are in a different product. <strong>Pawline Adopt</strong> focuses on adoptable shelter and rescue pets.</p>

    <section aria-labelledby="cat-ready"><h2 id="cat-ready">Readiness for a holiday cat adoption</h2>
      <p>Cats often need a closed room, consistent litter maintenance, and time away from door traffic. Households with frequent parties may struggle unless they can cordon off a calm space. Review housing rules, budget for litter and veterinary care, and agree on who scoops and feeds daily.</p>
    </section>

    <section aria-labelledby="cat-search"><h2 id="cat-search">Find adoptable cats near you</h2>
      <p>Search from a reachable location on the <a href={standalone ? "/#map" : "#map"}>Pawline Adopt map</a>. Read source labels, open the original listing, and confirm whether the cat is still available. For general search tips, see <a href={standalone ? "/guides/find-adoptable-pets-near-you" : "#guides/nearby"}>how to find adoptable pets near you</a>.</p>
      <p>Compare disclosed needs with your home and routine using the <a href={standalone ? "/guides/find-a-pet-that-fits-your-home-and-routine" : "#guides/matching"}>matching guide</a> before you visit.</p>
    </section>

    <section aria-labelledby="cat-hazards"><h2 id="cat-hazards">Holiday hazards to remove first</h2>
      <ul>
        <li>Lilies and unknown bouquets</li>
        <li>Tinsel, ribbon, string, and yarn</li>
        <li>Open flames and fragile ornaments</li>
        <li>Unattended food platters and bones</li>
        <li>Unsecured windows and dryer doors</li>
      </ul>
    </section>

    <section aria-labelledby="cat-intro"><h2 id="cat-intro">Introductions during a busy season</h2>
      <p>Keep the first introductions short. Give the cat a safe room with litter and hiding spots. Delay meeting guests and resident pets until the cat eats and uses the litter box reliably in that space. Ask the shelter what is known—and what is still unknown—about multi-pet homes.</p>
    </section>

    <section aria-labelledby="faq-cat"><h2 id="faq-cat">Frequently asked questions</h2>
      <dl className="faq-list">
        {faqItems.map((item, index) => <div key={index} className="faq-item">
          <dt><strong>{item.question}</strong></dt>
          <dd>{item.answer}</dd>
        </div>)}
      </dl>
    </section>

    <section className="methodology-next" aria-labelledby="next-cat">
      <h2 id="next-cat">Browse adoptable cats</h2>
      <p>Confirm every listing with the shelter or rescue before you plan a holiday pickup.</p>
      <a href={standalone ? "/#map" : "#map"}>Open the Pawline Adopt map <span aria-hidden="true">→</span></a>
    </section>
  </article></section>;
}
