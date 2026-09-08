const questions = [
  ["The listing", "Is this animal still available, and which listing or animal ID should I use when contacting you?"],
  ["The meeting", "Is the animal at a public shelter or in foster care? Where should we meet, and do I need an appointment?"],
  ["Your household", "What have you observed around children or other animals, and which details are still unknown?"],
  ["Daily life", "What routine does the animal have now? What should we discuss about time alone, activity, and my home?"],
  ["Care records", "Which care records can you share, and what follow-up should I discuss with a veterinarian or qualified professional?"],
  ["The next step", "What documents, fees, transport arrangements, and follow-up contacts should I confirm before applying or visiting?"],
];

export default function AdoptionChecklist({ standalone = false }) {
  return <section className="methodology-page guide-page"><article className="methodology-content">
    <p className="methodology-kicker">Shelter visit checklist</p>
    <h1>Questions to ask a shelter before adopting a pet</h1>
    <p className="methodology-lede">Bring the original listing, a realistic picture of your household, and a short list of unknowns. Use this checklist to prepare for a conversation, then confirm the next step with the organization caring for the animal.</p>
    <p>Prepared by Pawline · Reviewed <time dateTime="2026-09-08">September 8, 2026</time></p>

    <section aria-labelledby="before-contact"><h2 id="before-contact">Before you contact the shelter</h2>
      <p>Save the source URL and animal ID, not just a screenshot. Write down which information comes from the listing and which questions you still need answered. An approximate web lead on Pawline is a starting point for finding a resource, not confirmation that a particular animal is available.</p>
      <p>Adoption processes and fees vary by organization. The ASPCA recommends checking the shelter or rescue website for its process; some organizations operate facilities and others use foster homes. <a href="https://www.aspca.org/adopt-pet/adoption-tips">Read the ASPCA adoption overview</a>.</p>
    </section>

    <section aria-labelledby="shelter-questions"><h2 id="shelter-questions">Six questions to bring to the conversation</h2>
      <p>Check each topic as you discuss it. These checks stay on this page and reset when you leave or reload; no answers are submitted.</p>
      <ul className="adoption-checklist">{questions.map(([label, question]) => <li key={label}>
        <label><input type="checkbox" /><span><strong>{label}</strong> {question}</span></label>
      </li>)}</ul>
    </section>

    <section aria-labelledby="confirm-visit"><h2 id="confirm-visit">Confirm the visit before you travel</h2>
      <p>Ask for the agreed meeting place and contact method. Do not assume a map marker is a walk-in location or a foster home's address. If a listing changes or disappears, ask the shelter about its status instead of assuming the animal has been adopted.</p>
      <p>Check the organization's own instructions for documents and appointments. For example, the <a href="https://www.aspca.org/nyc/aspca-adoption-center-nyc">ASPCA's NYC adoption center</a> publishes its own visit and identification requirements. Those instructions apply to that center; ask your shelter for its requirements.</p>
    </section>

    <section aria-labelledby="after-conversation"><h2 id="after-conversation">After the conversation</h2>
      <p>Separate confirmed facts from open questions. If an answer is unknown, keep it unknown when comparing pets. Agree on who to contact next and whether another meeting or application is needed. A completed checklist or Pawline match score does not approve an adoption or establish compatibility.</p>
      <p>For another way to organize your questions, use the <a href={standalone ? "/guides/find-a-pet-that-fits-your-home-and-routine" : "#guides/matching"}>home and routine guide</a>. When you are ready to search, <a href={standalone ? "/#map" : "#map"}>return to the adoption map</a>.</p>
    </section>
  </article></section>;
}
