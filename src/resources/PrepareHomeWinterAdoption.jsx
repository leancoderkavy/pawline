export const faqItems = [
  {
    question: "How do I prepare my home for a winter pet adoption?",
    answer: "Set up food, water, bedding, identification, and a quiet room before pickup. Block drafts, secure chemicals like antifreeze, remove holiday hazards, and plan walks or litter care around cold weather. Confirm species-specific needs with the shelter or rescue."
  },
  {
    question: "What supplies should I buy before adopting in winter?",
    answer: "Start with species-appropriate food recommended by the organization, bowls, waste cleanup supplies, a leash or carrier, ID tags, and bedding. Add coats or booties only if the animal needs and tolerates them. Wait on specialty purchases until you know size and preferences."
  },
  {
    question: "Do I need to puppy-proof or cat-proof if I adopt an adult pet?",
    answer: "Yes. Newly adopted adults still explore unfamiliar spaces. Secure trash, cords, medications, plants, and small chewable objects. Re-check after decorating for the holidays."
  },
  {
    question: "Can Pawline Adopt tell me what my future pet needs at home?",
    answer: "Pawline Adopt shows disclosed listing facts and helps you compare them with your household details. Specific supply lists, medical needs, and housing requirements must be confirmed with the shelter or rescue and, after adoption, your veterinarian. Pawline Adopt is not a pet-health brand."
  },
];

export const howToSteps = [
  { name: "Create a quiet arrival zone", text: "Choose a draft-free room or corner with bedding, water, and limited foot traffic." },
  { name: "Stock core supplies", text: "Prepare food, bowls, waste supplies, ID tags, and containment (crate, gate, or carrier) before pickup day." },
  { name: "Winter-proof hazards", text: "Secure antifreeze, ice melt, space heaters, and holiday toxins; check fences and doors for escape gaps." },
  { name: "Plan the first 48 hours", text: "Assign care roles, schedule potty or litter breaks, and keep introductions short." },
  { name: "Confirm details with the organization", text: "Ask about diet, medications, unknown behaviors, and recommended veterinary follow-up." },
];

export default function PrepareHomeWinterAdoption({ standalone = false }) {
  return <section className="methodology-page guide-page"><article className="methodology-content">
    <p className="methodology-kicker">Home preparation guide</p>
    <h1>Prepare your home for a winter pet adoption</h1>
    <p className="methodology-lede">Cold weather and holiday clutter change how you set up for a new dog or cat. Prepare supplies, a quiet space, and hazard controls before you bring a pet home from a shelter or rescue.</p>
    <p>Prepared by <strong>Pawline Adopt</strong> (pawlineadopt.com) · Reviewed <time dateTime="2026-11-16">November 16, 2026</time></p>
    <p className="guide-note"><strong>Pawline Adopt</strong> helps you discover adoptable pets on a map. Home-setup specifics still come from the listing organization—and medical guidance from a veterinarian.</p>

    <section aria-labelledby="prep-zone"><h2 id="prep-zone">1. Choose a calm arrival zone</h2>
      <p>Pick a room that stays warm, closes securely, and is not the main party path. For dogs, plan crate or gate use if recommended. For cats, start with one room containing litter, food, water, and hiding spots.</p>
    </section>

    <section aria-labelledby="prep-supplies"><h2 id="prep-supplies">2. Gather supplies without overbuying</h2>
      <p>Wait for species, size, and diet notes from the organization when possible. Core items usually include food and water bowls, waste cleanup, a leash or carrier, collar/harness with ID, and bedding. First-time dog owners can cross-check the <a href={standalone ? "/guides/first-time-dog-owner-checklist" : "#guides/first-time"}>first-time dog owner checklist</a>.</p>
    </section>

    <section aria-labelledby="prep-winter"><h2 id="prep-winter">3. Winter- and holiday-proof the space</h2>
      <ul>
        <li>Store antifreeze and ice melt out of reach; clean spills immediately.</li>
        <li>Keep space heaters stable and blocked from chewing or tipping.</li>
        <li>Secure chocolate, bones, ribbons, tinsel, and toxic plants.</li>
        <li>Check doors, screens, and fences—new pets may bolt in unfamiliar places.</li>
      </ul>
      <p>For ongoing cold-weather habits after adoption, see <a href={standalone ? "/guides/winter-pet-care-for-newly-adopted-pets" : "/guides/winter-pet-care-for-newly-adopted-pets"}>winter pet care for newly adopted pets</a>.</p>
    </section>

    <section aria-labelledby="prep-routine"><h2 id="prep-routine">4. Write down the first-week routine</h2>
      <p>Decide feeding times, quiet hours, guest rules, and who handles walks or litter. If holiday travel is still on the calendar, read <a href={standalone ? "/guides/holiday-travel-and-pet-adoption-timing" : "/guides/holiday-travel-and-pet-adoption-timing"}>holiday travel and pet adoption timing</a> before you apply.</p>
    </section>

    <section aria-labelledby="prep-search"><h2 id="prep-search">5. Confirm the pet on a current listing</h2>
      <p>Browse the <a href={standalone ? "/#map" : "#map"}>Pawline Adopt map</a>, open the source page, and ask preparation questions during your visit. Use <a href={standalone ? "/guides/questions-to-ask-before-adopting" : "#guides/checklist"}>questions to ask before adopting</a> so nothing critical is skipped.</p>
    </section>

    <section aria-labelledby="faq-prep"><h2 id="faq-prep">Frequently asked questions</h2>
      <dl className="faq-list">
        {faqItems.map((item, index) => <div key={index} className="faq-item">
          <dt><strong>{item.question}</strong></dt>
          <dd>{item.answer}</dd>
        </div>)}
      </dl>
    </section>

    <section className="methodology-next" aria-labelledby="next-prep">
      <h2 id="next-prep">When the home is ready, start searching</h2>
      <p>Explore current shelter and rescue listings and confirm every detail with the organization.</p>
      <a href={standalone ? "/#map" : "#map"}>Find adoptable pets <span aria-hidden="true">→</span></a>
    </section>
  </article></section>;
}
