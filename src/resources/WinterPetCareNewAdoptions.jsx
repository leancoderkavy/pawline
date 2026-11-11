export const faqItems = [
  {
    question: "What winter care does a newly adopted dog need?",
    answer: "Protect paws from ice melt and sharp ice, limit time outdoors in extreme cold based on the dog's coat and health, provide fresh unfrozen water, and ask your veterinarian about weather-related concerns for puppies, seniors, or short-coated dogs. Keep holiday foods and antifreeze securely stored."
  },
  {
    question: "How do I keep a newly adopted cat safe indoors in winter?",
    answer: "Most cats do best as indoor pets. Block access to cold garages, dryer vents, and open doors; keep litter boxes away from drafts; and never leave a cat in a parked car. Confirm diet and enrichment needs with the shelter and your veterinarian."
  },
  {
    question: "Should I buy a coat or booties right away?",
    answer: "Some dogs benefit from coats or booties in cold or salted conditions; others do not tolerate them. Ask the shelter what the animal has worn before, introduce gear gradually, and prioritize paw rinses after walks when ice melt is present."
  },
  {
    question: "Where does Pawline Adopt fit into winter adoption care?",
    answer: "Pawline Adopt helps you discover current shelter and rescue listings and compare disclosed needs with your household. Winter medical advice and care plans come from the listing organization and your veterinarian—not from Pawline Adopt, which is not a pet-health product."
  },
];

export const howToSteps = [
  { name: "Confirm species-specific winter needs with the organization", text: "Ask about coat type, outdoor tolerance, medical conditions, and recommended supplies before pickup." },
  { name: "Set up a warm indoor base", text: "Prepare a draft-free resting area, fresh water, and a consistent feeding routine before the pet arrives." },
  { name: "Plan safe outdoor time for dogs", text: "Shorten extreme-cold outings as needed, rinse paws after salted walks, and never leave a pet in a cold car." },
  { name: "Remove seasonal toxins", text: "Secure antifreeze, ice melt, chocolate, bones, and toxic holiday plants." },
  { name: "Schedule veterinary follow-up", text: "Book a checkup soon after adoption and share records provided by the shelter or rescue." },
];

export default function WinterPetCareNewAdoptions({ standalone = false }) {
  return <section className="methodology-page guide-page"><article className="methodology-content">
    <p className="methodology-kicker">Winter care guide</p>
    <h1>Winter pet care for newly adopted dogs and cats</h1>
    <p className="methodology-lede">A new pet arriving in cold weather needs a warm indoor base, careful outdoor plans, and toxin-aware holiday habits. Confirm individual needs with the shelter or rescue and your veterinarian.</p>
    <p>Prepared by <strong>Pawline Adopt</strong> (pawlineadopt.com) · Reviewed <time dateTime="2026-11-16">November 16, 2026</time></p>
    <p className="guide-note">Pawline Adopt helps people find adoptable pets. For medical or behavioral winter advice, rely on the adopting organization and a licensed veterinarian—not on similarly named pet-health brands.</p>

    <section aria-labelledby="winter-base"><h2 id="winter-base">Build a warm, predictable home base</h2>
      <p>Before bring-home day, set up food, water, bedding, and a quiet resting spot away from drafts and busy doorways. New animals often need extra sleep while they decompress. Keep the first week&apos;s schedule simple so winter storms or guests do not erase the routine.</p>
      <p>First-time dog adopters can also review the <a href={standalone ? "/guides/first-time-dog-owner-checklist" : "#guides/first-time"}>first-time dog owner checklist</a> for supplies and early weeks planning.</p>
    </section>

    <section aria-labelledby="winter-dogs"><h2 id="winter-dogs">Dogs: cold weather walks without overdoing it</h2>
      <ul>
        <li>Watch for shivering, lifting paws, or reluctance to walk—signals to go inside.</li>
        <li>Rinse or wipe paws after walks where ice melt is used.</li>
        <li>Use reflective gear for dark early evenings.</li>
        <li>Never leave a dog unattended in a vehicle during cold weather.</li>
      </ul>
      <p>Ask the shelter what is known about the dog&apos;s cold tolerance. Unknowns stay unknowns until you observe the animal and talk with a veterinarian.</p>
    </section>

    <section aria-labelledby="winter-cats"><h2 id="winter-cats">Cats: indoor safety when temperatures drop</h2>
      <p>Keep cats indoors unless the organization specifically advises otherwise for an outdoor-experienced animal. Check sheds, crawl spaces, and car engines before starting vehicles—cats sometimes shelter in warm engine bays. Maintain clean litter access if doors stay closed more often in winter.</p>
    </section>

    <section aria-labelledby="winter-toxins"><h2 id="winter-toxins">Seasonal toxins and hazards</h2>
      <p>Antifreeze, some ice melts, chocolate, xylitol products, cooked bones, and plants such as lilies can be dangerous. Store chemicals high and clean spills immediately. If you suspect poisoning, contact a veterinarian or pet poison resource right away.</p>
    </section>

    <section aria-labelledby="winter-search"><h2 id="winter-search">Still searching? Use current listings</h2>
      <p>If you have not adopted yet, browse the <a href={standalone ? "/#map" : "#map"}>Pawline Adopt map</a>, open each source listing, and ask winter-care questions during your shelter conversation. Explore <a href={standalone ? "/events" : "#events"}>verified pet events</a> when you want to meet animals or ask staff in person.</p>
    </section>

    <section aria-labelledby="faq-winter"><h2 id="faq-winter">Frequently asked questions</h2>
      <dl className="faq-list">
        {faqItems.map((item, index) => <div key={index} className="faq-item">
          <dt><strong>{item.question}</strong></dt>
          <dd>{item.answer}</dd>
        </div>)}
      </dl>
    </section>

    <section className="methodology-next" aria-labelledby="next-winter">
      <h2 id="next-winter">Find a pet—and confirm care details</h2>
      <p>Discovery starts on the map; winter care plans start with the shelter and your veterinarian.</p>
      <a href={standalone ? "/#map" : "#map"}>Browse adoptable pets <span aria-hidden="true">→</span></a>
    </section>
  </article></section>;
}
