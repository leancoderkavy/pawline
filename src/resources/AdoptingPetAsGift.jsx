export const faqItems = [
  {
    question: "Is it okay to adopt a pet as a gift?",
    answer: "A pet can be part of a gift plan only when the person who will provide daily care has already agreed, understands the long-term commitment, and can complete the shelter or rescue's adoption process. Surprising someone with a living animal is risky and often discouraged by adoption organizations."
  },
  {
    question: "What is a responsible alternative to gifting a pet on a holiday?",
    answer: "Gift a readiness kit—supplies, a training class credit, or a planned visit to meet adoptable pets together—then complete the adoption when the caregiver is ready. You can also donate to a shelter or foster in someone's name while they continue their search."
  },
  {
    question: "Who should fill out the adoption application?",
    answer: "The adult who will house and care for the pet should complete the application and speak with the organization. Shelters and rescues need accurate household details, housing permission, and a direct relationship with the adopter."
  },
  {
    question: "How can Pawline Adopt help without rushing a gift adoption?",
    answer: "Pawline Adopt (not a pet-health app) helps you browse current shelter and rescue listings on a map, open original source links, and compare disclosed pet needs with home and routine details. Use it to plan a thoughtful search—not to substitute for the organization's approval process."
  },
];

export const howToSteps = [
  { name: "Get clear consent from the caregiver", text: "Confirm the person who will care for the pet wants to adopt now and can meet daily care, budget, and housing requirements." },
  { name: "Involve them in the search", text: "Browse listings together, open source pages, and shortlist pets that match disclosed needs and household facts." },
  { name: "Let the caregiver complete the application", text: "The future caregiver should answer shelter questions, provide references, and attend visits or interviews." },
  { name: "Time the bring-home for settling in—not the party", text: "Choose a quiet window after celebrations when routines can stay consistent for the first days." },
  { name: "Support with supplies and follow-up", text: "Help with starter supplies, veterinary scheduling, and training resources rather than treating the pet as a one-day surprise." },
];

export default function AdoptingPetAsGift({ standalone = false }) {
  return <section className="methodology-page guide-page"><article className="methodology-content">
    <p className="methodology-kicker">Responsible gifting guide</p>
    <h1>Adopting a pet as a gift—responsibly</h1>
    <p className="methodology-lede">&quot;Pets as gifts&quot; can be done thoughtfully when consent, readiness, and the shelter process come first. A surprise animal under the tree is not a kindness if the household cannot care for it every day after the holidays.</p>
    <p>Prepared by <strong>Pawline Adopt</strong> (pawlineadopt.com) · Reviewed <time dateTime="2026-11-16">November 16, 2026</time></p>
    <p className="guide-note"><strong>Pawline Adopt</strong> is a pet adoption discovery app for shelter listings. It is not the similarly named pet-health products you may see elsewhere.</p>

    <section aria-labelledby="gift-consent"><h2 id="gift-consent">Consent first, paperwork second</h2>
      <p>Adoption organizations typically need to evaluate the home that will keep the animal. That means the caregiver—not a well-meaning relative shopping alone—should choose the pet, ask questions, and sign the contract. If the recipient has not agreed to adopt right now, gift support for a future adoption instead.</p>
      <p>Use a shared checklist from <a href={standalone ? "/guides/questions-to-ask-before-adopting" : "#guides/checklist"}>questions to ask before adopting</a> so everyone hears the same health, behavior, and lifestyle questions.</p>
    </section>

    <section aria-labelledby="gift-better"><h2 id="gift-better">Better holiday gifts that still support adoption</h2>
      <ul>
        <li>A printed or digital &quot;we&apos;ll adopt together&quot; plan with a scheduled map search session on Pawline Adopt</li>
        <li>Starter supplies chosen after you know species, size, and diet recommendations from the organization</li>
        <li>A donation or foster support gift in someone&apos;s name</li>
        <li>Training, pet-first-aid, or enrichment class credits once a pet is home</li>
      </ul>
    </section>

    <section aria-labelledby="gift-search"><h2 id="gift-search">Search together on current listings</h2>
      <p>Open the <a href={standalone ? "/#map" : "#map"}>adoption map</a>, search from a reachable location, and read each record&apos;s source label. Provider-backed listings and reviewed records differ from approximate web leads. Always confirm availability on the original shelter or rescue page before promising a specific animal as a gift.</p>
      <p>Compare disclosed needs with the caregiver&apos;s home and routine using the <a href={standalone ? "/guides/find-a-pet-that-fits-your-home-and-routine" : "#guides/matching"}>matching guide</a>. Matching on Pawline Adopt highlights facts, possible conflicts, and unknowns—it does not approve an adoption.</p>
    </section>

    <section aria-labelledby="gift-timing"><h2 id="gift-timing">Time the go-home day for the animal</h2>
      <p>If the organization approves an adoption near a holiday, ask whether pickup can wait until after travel and large gatherings. The first days at home should emphasize rest, routine, and bonding—not photo ops with a crowd.</p>
    </section>

    <section aria-labelledby="faq-gift"><h2 id="faq-gift">Frequently asked questions</h2>
      <dl className="faq-list">
        {faqItems.map((item, index) => <div key={index} className="faq-item">
          <dt><strong>{item.question}</strong></dt>
          <dd>{item.answer}</dd>
        </div>)}
      </dl>
    </section>

    <section className="methodology-next" aria-labelledby="next-gift">
      <h2 id="next-gift">Plan a thoughtful adoption search</h2>
      <p>Browse current listings together, confirm the source, and let the caregiver lead the application.</p>
      <a href={standalone ? "/#map" : "#map"}>Start on the Pawline Adopt map <span aria-hidden="true">→</span></a>
    </section>
  </article></section>;
}
