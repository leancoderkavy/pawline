const sources = {
  aahaLifeStage: "https://www.aaha.org/resources/senior-dog-life-stage/",
  aahaSeniorStatus: "https://www.aaha.org/resources/senior-status-understanding-your-senior-pets-life-stage/",
  avma: "https://www.avma.org/resources-tools/pet-owners/petcare/senior-pets",
  aspca: "https://www.aspca.org/news/5-expert-tips-caring-senior-pets",
  bestFriends: "https://bestfriends.org/pet-care-resources/senior-dog-care-tips-keep-older-dogs-happy-and-healthy",
};

export const faqItems = [
  {
    question: "At what age is a dog considered senior?",
    answer: "There is no single cutoff. Veterinary groups such as AAHA and the ASPCA note that the senior life stage depends on a dog's size and breed, and larger dogs tend to reach it earlier than smaller dogs. Ask the shelter how they estimated the dog's age and ask your veterinarian which life stage applies to that dog.",
  },
  {
    question: "Are senior dogs good for first-time owners?",
    answer: "They can be. An adult dog's size, energy, and personality are already visible, and shelter staff may be able to describe how the dog behaves in a home. The trade-off is that older dogs may need more veterinary attention and some home adjustments, so plan time and budget for that before you adopt.",
  },
  {
    question: "How often should a senior dog see the vet?",
    answer: "AAHA and the ASPCA recommend that senior dogs be examined more often than younger adults, generally about twice a year. Book a first visit soon after adoption so your veterinarian can set a schedule that fits the individual dog.",
  },
  {
    question: "Can I search Pawline for senior dogs only?",
    answer: "Not at the moment. Pawline does not have an age or senior filter. Many listings show an age provided by the shelter or rescue, and some show the age as unknown. Search adoptable dogs near you, read the age on each listing, and confirm the age and history with the organization.",
  },
];

export const howToSteps = [
  { name: "Learn what senior means for that dog", text: "Senior status varies by size and breed, so ask the shelter how the age was estimated and confirm the life stage with a veterinarian." },
  { name: "Ask the shelter for history and records", text: "Request any intake exam notes, current medications, known conditions, and how the dog behaves with people, children, and other animals." },
  { name: "Plan for veterinary care", text: "Book a baseline exam soon after adoption and expect checkups about twice a year, as AAHA and the ASPCA recommend for senior dogs." },
  { name: "Adjust your home", text: "Add traction on slick floors, a ramp or steps for favorite spots, and a comfortable bed in a quiet area." },
  { name: "Settle in gradually", text: "Keep routines predictable, keep walks short at first, and watch for changes in appetite, mobility, or behavior to report to your veterinarian." },
];

function Cite({ href, children }) {
  return <a href={href} rel="noopener" target="_blank">{children}</a>;
}

export default function AdoptingASeniorDog() {
  return <section className="methodology-page guide-page"><article className="methodology-content">
    <p className="methodology-kicker">Senior dog adoption guide</p>
    <h1>Adopting a senior dog: what to know before you bring one home</h1>
    <p className="methodology-lede">An older dog can be a calm, settled companion. Use this guide to understand what senior means, which questions to ask the shelter, how to plan veterinary care, and how to set up your home before you adopt.</p>
    <p>Prepared by <strong>Pawline Adopt</strong> (pawlineadopt.com) · Reviewed <time dateTime="2026-11-16">November 16, 2026</time></p>
    <p className="guide-note">This guide is general information, not veterinary advice. Health questions about a specific dog belong with the shelter that cares for the dog now and with your veterinarian after adoption.</p>

    <section aria-labelledby="senior-what"><h2 id="senior-what">What counts as a senior dog</h2>
      <p>No single birthday turns a dog into a senior. The American Animal Hospital Association explains that the <Cite href={sources.aahaSeniorStatus}>senior life stage varies with a dog's size and breed</Cite>, and the <Cite href={sources.aspca}>ASPCA</Cite> notes that larger dogs generally reach it earlier than smaller dogs. A listing that says &quot;8 years&quot; can describe a dog in mid-life or a dog well into its senior years, depending on the dog.</p>
      <p>Shelter ages are often estimates, especially for dogs that arrived as strays. Ask how the age was determined, and let your veterinarian tell you which life stage applies once you have adopted.</p>
    </section>

    <section aria-labelledby="senior-why"><h2 id="senior-why">Why people choose older dogs</h2>
      <p>With an adult or senior dog, what you meet is closer to what you get. Size and coat are final, energy level is easier to judge, and shelter staff or foster families may be able to describe how the dog behaves in a home. Many older dogs have lived with people before and already know household routines, although every dog is an individual and some will still need house-training refreshers in a new place.</p>
      <p>Older dogs also suit households that want a slower pace: shorter walks, more naps, and fewer puppy-stage surprises. The trade-off is that you are more likely to manage age-related care, so decide in advance whether your time and budget leave room for it.</p>
    </section>

    <section aria-labelledby="senior-questions"><h2 id="senior-questions">Questions to ask the shelter</h2>
      <p>The organization caring for the dog knows more than any listing can show. <Cite href={sources.bestFriends}>Best Friends Animal Society</Cite> stresses regular veterinary care for senior dogs, so start by asking what care the dog has already had:</p>
      <ul>
        <li><strong>Medical history:</strong> Was there an intake or recent veterinary exam? Can you get copies of the records to share with your own veterinarian?</li>
        <li><strong>Medications and conditions:</strong> Is the dog on any medication or special diet now? Are there known conditions, and what follow-up was recommended?</li>
        <li><strong>Age estimate:</strong> Is the age documented from a previous home, or estimated during intake?</li>
        <li><strong>Behavior at home:</strong> How does the dog do with children, other dogs, cats, visitors, and time alone? Has the dog been in a foster home?</li>
        <li><strong>Mobility and comfort:</strong> Does the dog handle stairs, car rides, and slick floors? How long are comfortable walks?</li>
        <li><strong>Background:</strong> Why did the dog come to the shelter, and is there anything about the previous home the staff can share?</li>
      </ul>
      <p>Bring the full <a href="/guides/questions-to-ask-before-adopting">list of questions to ask before adopting</a> so availability, meeting arrangements, and next steps are covered as well.</p>
    </section>

    <section aria-labelledby="senior-vet"><h2 id="senior-vet">Plan your budget and veterinary care</h2>
      <p>AAHA recommends that <Cite href={sources.aahaLifeStage}>senior dogs have veterinary exams about every six months</Cite>, and the <Cite href={sources.aspca}>ASPCA advises at least twice-yearly checkups</Cite> for older pets so that changes are caught early. Plan on a baseline exam soon after adoption, even if the shelter already examined the dog, so your veterinarian can record a starting point and set a schedule.</p>
      <p>Veterinary costs vary widely by region, clinic, and the individual dog, so ask a local clinic what a senior wellness visit and any recommended tests usually cost before you commit. If the shelter shares records, bring them to the first appointment. The <Cite href={sources.avma}>AVMA's senior pet care guidance</Cite> also highlights dental care and changes in mobility as topics to raise with your veterinarian.</p>
    </section>

    <section aria-labelledby="senior-home"><h2 id="senior-home">Set up your home for an older dog</h2>
      <p>Small changes make a big difference for a dog with stiffer joints or weaker eyesight. The <Cite href={sources.avma}>AVMA</Cite> and the <Cite href={sources.aspca}>ASPCA</Cite> both suggest adjusting the home to an older pet's mobility:</p>
      <ul>
        <li><strong>Traction:</strong> Put rugs or runners on slick floors where the dog walks, eats, and gets up from rest.</li>
        <li><strong>Fewer climbs:</strong> Add a ramp or pet steps to a favorite couch, bed, or car, and gate off stairs if they are hard for the dog.</li>
        <li><strong>A supportive bed:</strong> Place a padded bed in a quiet, draft-free spot away from heavy foot traffic.</li>
        <li><strong>Easy access:</strong> Keep food and water where the dog does not need to navigate stairs to reach them.</li>
        <li><strong>A predictable layout:</strong> Avoid moving furniture around in the first weeks, which can help a dog with reduced vision.</li>
      </ul>
    </section>

    <section aria-labelledby="senior-first-weeks"><h2 id="senior-first-weeks">The first weeks together</h2>
      <p>Any newly adopted dog needs time to decompress. Keep the routine simple: regular meals, short and gentle walks, and plenty of rest. Introduce new people and pets slowly, and write down anything you notice about appetite, drinking, bathroom habits, mobility, or sleep so you can share it with your veterinarian.</p>
      <p>The <a href="/guides/first-time-dog-owner-checklist">first time dog owner checklist</a> covers supplies and household preparation, and the guide on <a href="/guides/how-to-adopt-a-dog">how to adopt a dog</a> walks through the adoption process from application to the first two weeks at home.</p>
    </section>

    <section aria-labelledby="faq-senior"><h2 id="faq-senior">Frequently asked questions</h2>
      <dl className="faq-list">
        {faqItems.map((item, index) => <div key={index} className="faq-item">
          <dt><strong>{item.question}</strong></dt>
          <dd>{item.answer}</dd>
        </div>)}
      </dl>
    </section>

    <section className="methodology-next" aria-labelledby="next-senior">
      <h2 id="next-senior">Find a senior dog near you</h2>
      <p>Pawline does not filter by age. Search adoptable dogs near you, check the age shown on each listing (some say the age is unknown), and confirm the dog's age, health history, and availability directly with the shelter or rescue.</p>
      <a className="button-primary" href="/#map">Search adoptable dogs near you</a>
      <p>Not sure where to start? Read <a href="/guides/find-adoptable-pets-near-you">how to find adoptable pets near you</a> to understand listing sources and what to confirm.</p>
    </section>
  </article></section>;
}
