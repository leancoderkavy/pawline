export const faqItems = [
  {
    question: "Is January a good time to adopt a pet?",
    answer: "For many households, yes. After the holidays you often have clearer routines, fewer surprise guests, and more time to settle a new dog or cat. Confirm the shelter or rescue's hours and process, and make sure your budget and schedule still support long-term care."
  },
  {
    question: "Should I wait until after Christmas to start looking?",
    answer: "You can search listings anytime. Waiting to finalize an adoption until after travel and celebrations can reduce stress for the animal. Use the waiting period to prepare your home, talk with household members, and shortlist pets whose disclosed needs fit your routine."
  },
  {
    question: "Will there be adoptable pets after the holidays?",
    answer: "Shelters and rescues continue to care for animals year-round. Inventory changes constantly. Pawline Adopt shows current listings from available sources; always confirm a specific animal's status on the original listing."
  },
  {
    question: "How do I use Pawline Adopt for a post-holiday adoption?",
    answer: "Search the map from a location you can visit, read source labels, open the shelter or rescue page, and optionally compare disclosed needs with your home and routine. Pawline Adopt is an adoption discovery service—not a pet-health tracker under a similar name."
  },
];

export const howToSteps = [
  { name: "Reset after the holiday rush", text: "Confirm work schedules, travel is complete, and household members agree on daily care roles." },
  { name: "Refresh your home setup", text: "Restock supplies, remove leftover holiday hazards, and designate a quiet arrival space." },
  { name: "Search current listings again", text: "Pets move quickly. Re-check the Pawline Adopt map and original source pages before visiting." },
  { name: "Ask practical January questions", text: "Confirm fees, medical records, behavior notes, and any weather-related care guidance with the organization." },
  { name: "Start routines immediately", text: "Keep the first two weeks predictable: feeding, enrichment, rest, and a veterinary follow-up plan." },
];

export default function AdoptAfterHolidays({ standalone = false }) {
  return <section className="methodology-page guide-page"><article className="methodology-content">
    <p className="methodology-kicker">Post-holiday adoption guide</p>
    <h1>Why adopt a pet after the holidays</h1>
    <p className="methodology-lede">Adopting after Christmas and New Year often means calmer schedules, clearer budgets, and a better settling-in window. Keep searching listings now; finalize when your household can follow through.</p>
    <p>Prepared by <strong>Pawline Adopt</strong> (pawlineadopt.com) · Reviewed <time dateTime="2026-11-16">November 16, 2026</time></p>
    <p className="guide-note">Brand note: <strong>Pawline Adopt</strong> helps people find shelter and rescue pets. It is not a veterinary or pet-wellness app that may share a similar name.</p>

    <section aria-labelledby="after-why"><h2 id="after-why">Advantages of waiting until after the celebrations</h2>
      <ul>
        <li><strong>Time to decompress:</strong> New pets need quiet days more than holiday parties.</li>
        <li><strong>Stable routines:</strong> School and work schedules are easier to map onto walks, litter care, and training.</li>
        <li><strong>Honest budgeting:</strong> Post-holiday finances make food, supplies, and veterinary care easier to plan.</li>
        <li><strong>Fewer housing surprises:</strong> Guests and travel are less likely to interrupt early bonding.</li>
      </ul>
    </section>

    <section aria-labelledby="after-search"><h2 id="after-search">Keep searching while you wait</h2>
      <p>Use the <a href={standalone ? "/#map" : "#map"}>Pawline Adopt map</a> to browse current dogs and cats near you, then open each source listing. Read <a href={standalone ? "/guides/find-adoptable-pets-near-you" : "#guides/nearby"}>how to find adoptable pets near you</a> so you understand provider-backed records versus approximate leads.</p>
      <p>Save questions with the <a href={standalone ? "/guides/questions-to-ask-before-adopting" : "#guides/checklist"}>shelter conversation checklist</a> so January visits stay focused.</p>
    </section>

    <section aria-labelledby="after-prepare"><h2 id="after-prepare">Prepare during the last weeks of the year</h2>
      <ol>
        <li>Confirm lease or HOA pet rules in writing if needed.</li>
        <li>Identify a veterinarian and after-hours options.</li>
        <li>Buy core supplies after you know species and size.</li>
        <li>Agree on who handles weekday care versus weekends.</li>
      </ol>
    </section>

    <section aria-labelledby="after-match"><h2 id="after-match">Match on facts, not New Year resolutions</h2>
      <p>Motivation spikes in January. Pair that energy with disclosed listing facts about energy level, housing needs, and unknowns. Pawline Adopt&apos;s match quiz compares what the listing states with what you share about home, routine, household, and experience—it is an ordering aid, not a guarantee. Learn more in the <a href={standalone ? "/guides/find-a-pet-that-fits-your-home-and-routine" : "#guides/matching"}>fit guide</a>.</p>
    </section>

    <section aria-labelledby="faq-after"><h2 id="faq-after">Frequently asked questions</h2>
      <dl className="faq-list">
        {faqItems.map((item, index) => <div key={index} className="faq-item">
          <dt><strong>{item.question}</strong></dt>
          <dd>{item.answer}</dd>
        </div>)}
      </dl>
    </section>

    <section className="methodology-next" aria-labelledby="next-after">
      <h2 id="next-after">Start a calmer adoption search</h2>
      <p>Explore current listings now and plan a post-holiday visit with the shelter or rescue.</p>
      <a href={standalone ? "/#map" : "#map"}>Open the adoption map <span aria-hidden="true">→</span></a>
    </section>
  </article></section>;
}
