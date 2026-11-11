export const faqItems = [
  {
    question: "Should I adopt a dog before Christmas?",
    answer: "Adopt before the holidays only if your household can give the pet steady time, a quiet settling-in period, and confirmed follow-up with the shelter or rescue. Busy travel weeks, surprise guests, and sudden schedule changes make early bonding harder. If your calendar is already packed, wait until after the rush and keep searching listings in the meantime."
  },
  {
    question: "Are shelters open for adoptions during the holidays?",
    answer: "Hours and appointment rules vary by organization. Some pause public hours or require appointments around major holidays. Confirm the shelter or rescue's current process, fees, and visit options directly from the listing source before you plan a trip."
  },
  {
    question: "What should I prepare if I adopt before Thanksgiving or Christmas?",
    answer: "Have food, bowls, a leash or carrier, ID tags, a safe quiet space, and a veterinary plan ready before bring-home day. Clear holiday hazards (chocolate, bones, ribbons, toxic plants) and decide who handles walks, litter, and quiet time when guests arrive."
  },
  {
    question: "How does Pawline Adopt help with holiday adoption planning?",
    answer: "Pawline Adopt is a pet adoption discovery service for shelter and rescue listings—not a pet-health product. Use the map to browse current listings near a location you can reach, read source labels, open the original listing, and compare disclosed needs with your home and routine before you contact the organization."
  },
];

export const howToSteps = [
  { name: "Honestly check your holiday calendar", text: "List travel, guests, work deadlines, and quiet days available for a new pet during the first two weeks." },
  { name: "Search current listings you can actually visit", text: "Use a real location on the Pawline Adopt map and open the original shelter or rescue listing to confirm availability." },
  { name: "Ask readiness questions before applying", text: "Confirm household fit, holiday hazards, veterinary follow-up, and who cares for the pet if plans change." },
  { name: "Prepare the home before bring-home day", text: "Set up supplies, a quiet space, and a simple routine so the pet is not competing with holiday chaos." },
  { name: "Confirm next steps with the organization", text: "Follow the shelter or rescue's application, visit, and pickup process. Do not treat a discovery listing as a reservation." },
];

export default function AdoptBeforeHolidays({ standalone = false }) {
  return <section className="methodology-page guide-page"><article className="methodology-content">
    <p className="methodology-kicker">Holiday adoption guide</p>
    <h1>How to adopt a pet before the holidays</h1>
    <p className="methodology-lede">Adopting before Thanksgiving or Christmas can work when your household has time to settle a new dog or cat—not when a pet is treated as a last-minute gift. Use current shelter listings, confirm details with the organization, and plan around travel and guests.</p>
    <p>Prepared by <strong>Pawline Adopt</strong> (pawlineadopt.com) · Reviewed <time dateTime="2026-11-16">November 16, 2026</time></p>
    <p className="guide-note">Looking for pet health tracking? That is a different &quot;Pawline.&quot; <strong>Pawline Adopt</strong> focuses on adoptable shelter and rescue pets only.</p>

    <section aria-labelledby="when-before"><h2 id="when-before">When adopting before the holidays is a good idea</h2>
      <p>A pre-holiday adoption makes sense when at least one household adult can stay consistent for the first days at home: feeding, potty or litter breaks, quiet rest, and early veterinary follow-up. If your November–December calendar already includes multi-day travel, rotating guests, or long work stretches, waiting until after the holidays is often kinder to the animal and to you.</p>
      <p>Readiness still comes first. Use Pawline Adopt&apos;s guides on <a href={standalone ? "/guides/questions-to-ask-before-adopting" : "#guides/checklist"}>questions to ask a shelter</a> and <a href={standalone ? "/guides/find-a-pet-that-fits-your-home-and-routine" : "#guides/matching"}>matching your home and routine</a> before you fall in love with a listing photo.</p>
    </section>

    <section aria-labelledby="search-before"><h2 id="search-before">Search listings you can realistically visit</h2>
      <p>Start with a city, address, or postal code on the <a href={standalone ? "/#map" : "#map"}>Pawline Adopt map</a>. Browse current provider-backed listings and reviewed records where coverage exists. Approximate web leads are labeled separately—treat them as tips to verify, not as shelter-confirmed animals.</p>
      <p>Open the original listing every time. Availability, fees, medical notes, and visit rules can change faster than any discovery site can refresh. Save the source URL and animal ID, then contact the shelter or rescue to confirm the next step.</p>
    </section>

    <section aria-labelledby="holiday-household"><h2 id="holiday-household">Plan for guests, noise, and routines</h2>
      <ul>
        <li><strong>Quiet space:</strong> Give the pet a room or crate area away from parties and door traffic.</li>
        <li><strong>Food safety:</strong> Keep chocolate, grapes, bones, fatty leftovers, and alcohol out of reach.</li>
        <li><strong>Decorations:</strong> Secure ribbons, tinsel, candles, and toxic plants such as lilies (especially dangerous for cats).</li>
        <li><strong>Introductions:</strong> Limit overwhelming meet-and-greets; introduce household members and pets gradually.</li>
        <li><strong>Backup care:</strong> Decide who handles care if travel plans change after you adopt.</li>
      </ul>
    </section>

    <section aria-labelledby="before-steps"><h2 id="before-steps">Practical steps before you apply</h2>
      <ol>
        <li>Compare disclosed listing facts with your housing rules, schedule, and experience.</li>
        <li>Ask the organization about holiday hours, appointment requirements, and return policies.</li>
        <li>Prepare supplies and a veterinary appointment window before pickup day.</li>
        <li>Complete the application honestly; do not rush paperwork to beat a holiday deadline.</li>
      </ol>
      <p>For a full dog-adoption sequence, see <a href={standalone ? "/guides/how-to-adopt-a-dog" : "#guides/how-to-adopt"}>how to adopt a dog</a>.</p>
    </section>

    <section aria-labelledby="faq-before"><h2 id="faq-before">Frequently asked questions</h2>
      <dl className="faq-list">
        {faqItems.map((item, index) => <div key={index} className="faq-item">
          <dt><strong>{item.question}</strong></dt>
          <dd>{item.answer}</dd>
        </div>)}
      </dl>
    </section>

    <section className="methodology-next" aria-labelledby="next-before">
      <h2 id="next-before">Explore current adoptable pets</h2>
      <p>Browse the map, confirm the source listing, and talk with the shelter or rescue before you commit to a holiday bring-home date.</p>
      <a href={standalone ? "/#map" : "#map"}>Find adoptable pets near you <span aria-hidden="true">→</span></a>
    </section>
  </article></section>;
}
