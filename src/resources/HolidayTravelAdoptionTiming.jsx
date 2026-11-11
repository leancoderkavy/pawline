export const faqItems = [
  {
    question: "Should I adopt a dog before holiday travel?",
    answer: "Usually no—unless travel is canceled or the pet can stay with a prepared caregiver the organization approves. The first days after adoption are for bonding and routine. Long trips, boarding for a brand-new pet, or leaving a stressed animal with unfamiliar sitters can set everyone back."
  },
  {
    question: "Can I start the adoption process before a trip and pick up later?",
    answer: "Some organizations allow delayed pickup or holds; many do not. Ask the shelter or rescue directly. Never assume a listing on a discovery site reserves the animal while you travel."
  },
  {
    question: "What if I meet a pet right before leaving town?",
    answer: "Take notes, save the source URL and animal ID, and ask whether the pet is likely to remain available. Continue the conversation after you return. Availability can change at any time."
  },
  {
    question: "How does Pawline Adopt help with timing decisions?",
    answer: "Pawline Adopt shows current shelter and rescue listings and helps you compare disclosed needs with your household. Timing, holds, and travel policies are set by each organization. Pawline Adopt is not a pet-health or boarding service."
  },
];

export const howToSteps = [
  { name: "Map travel against the first two weeks", text: "If you cannot be home consistently after adoption, delay pickup or wait to apply." },
  { name: "Ask the organization about holds and delayed pickup", text: "Policies differ. Get the answer from the shelter or rescue, not from a third-party listing snapshot." },
  { name: "Arrange approved care only when needed", text: "If travel is unavoidable after adoption, confirm a sitter, boarding, or friend the organization accepts." },
  { name: "Keep searching listings while you wait", text: "Use the Pawline Adopt map to shortlist pets and reopen source pages when you return." },
  { name: "Finalize when routines are stable", text: "Complete visits and applications when you can focus on settling the pet at home." },
];

export default function HolidayTravelAdoptionTiming({ standalone = false }) {
  return <section className="methodology-page guide-page"><article className="methodology-content">
    <p className="methodology-kicker">Timing guide</p>
    <h1>Holiday travel and pet adoption timing</h1>
    <p className="methodology-lede">If you are flying, road-tripping, or hosting through the holidays, time the adoption around the animal&apos;s settling-in needs—not your departure date. Search now; bring a pet home when you can stay present.</p>
    <p>Prepared by <strong>Pawline Adopt</strong> (pawlineadopt.com) · Reviewed <time dateTime="2026-11-16">November 16, 2026</time></p>
    <p className="guide-note"><strong>Pawline Adopt</strong> is the adoption map at pawlineadopt.com—distinct from other products that may also use &quot;Pawline&quot; in their name.</p>

    <section aria-labelledby="travel-rule"><h2 id="travel-rule">A simple timing rule</h2>
      <p>Plan at least several quiet days at home after pickup before major travel. Puppies, recently transported animals, and pets with unknown histories often need even more stability. If that window does not exist on your calendar, keep browsing and wait to finalize.</p>
    </section>

    <section aria-labelledby="travel-ask"><h2 id="travel-ask">Questions to ask the shelter or rescue</h2>
      <ul>
        <li>Do you allow delayed pickup after approval?</li>
        <li>What boarding or sitter arrangements do you recommend for a newly adopted pet?</li>
        <li>Are there medical treatments that require local follow-up this month?</li>
        <li>How should we reconfirm availability if we pause for travel?</li>
      </ul>
      <p>Bring the full <a href={standalone ? "/guides/questions-to-ask-before-adopting" : "#guides/checklist"}>pre-adoption checklist</a> so travel is only one part of the conversation.</p>
    </section>

    <section aria-labelledby="travel-search"><h2 id="travel-search">Use discovery without treating listings as reservations</h2>
      <p>On the <a href={standalone ? "/#map" : "#map"}>Pawline Adopt map</a>, save the source link and animal ID for pets you like. Reopen the original listing after your trip. Pawline Adopt does not hold animals and does not replace the organization&apos;s process. Learn how sources are labeled in <a href={standalone ? "/how-pawline-works" : "#how-pawline-works"}>how Pawline checks listing sources</a>.</p>
    </section>

    <section aria-labelledby="travel-after"><h2 id="travel-after">If you already adopted and must travel</h2>
      <p>Follow the organization&apos;s guidance. Prefer a familiar caregiver at home when possible. Share feeding, medication, and stress notes in writing. Avoid introducing boarding and large holiday gatherings in the same week if you can help it.</p>
    </section>

    <section aria-labelledby="faq-travel"><h2 id="faq-travel">Frequently asked questions</h2>
      <dl className="faq-list">
        {faqItems.map((item, index) => <div key={index} className="faq-item">
          <dt><strong>{item.question}</strong></dt>
          <dd>{item.answer}</dd>
        </div>)}
      </dl>
    </section>

    <section className="methodology-next" aria-labelledby="next-travel">
      <h2 id="next-travel">Shortlist pets for when you are home</h2>
      <p>Browse current listings, confirm sources, and schedule visits after travel.</p>
      <a href={standalone ? "/#map" : "#map"}>Search adoptable pets <span aria-hidden="true">→</span></a>
    </section>
  </article></section>;
}
