const faqItems = [
  {
    question: "How much does it cost to adopt a dog?",
    answer: "Adoption fees vary by organization but typically range from $50 to $300 according to the ASPCA. Fees often include spaying or neutering, vaccinations, and microchipping. Contact the shelter or rescue directly to confirm their specific fees and what services are included."
  },
  {
    question: "How long does the dog adoption process take?",
    answer: "The timeline varies by organization and can range from a few days to several weeks. Some shelters allow same-day adoptions after an application and brief interview, while others require home visits, reference checks, and waiting periods. Ask the organization about their specific process when you first contact them."
  },
  {
    question: "What questions should I ask before adopting a dog?",
    answer: "Ask about the dog's availability, health records, behavior around children or other animals, daily routine, and any unknowns. Confirm the adoption requirements, fees, and next steps. Use a practical checklist to prepare for your shelter conversation."
  },
  {
    question: "Can I adopt a dog if I live in an apartment?",
    answer: "Yes, many dogs can thrive in apartments. Consider the dog's size, energy level, and exercise needs. Some landlords have pet policies or restrictions, so confirm your lease terms first. Shelters can help you find dogs suited to apartment living."
  },
  {
    question: "What do I need to prepare before bringing a dog home?",
    answer: "Essential items include food and water bowls, quality dog food, a collar with ID tags, a leash, a bed or crate, and toys. Prepare a designated area for your dog and remove hazards like toxic plants or small objects. Schedule a veterinary visit within the first week."
  },
  {
    question: "How do I know if I'm ready to adopt a dog?",
    answer: "Consider your daily schedule, living situation, budget, and long-term commitment. Dogs need time, attention, exercise, training, and veterinary care. Be honest about your routine and household when comparing available dogs. A shelter can help assess whether a specific dog fits your situation."
  },
];

export default function HowToAdoptADog({ standalone = false }) {
  return <section className="methodology-page guide-page"><article className="methodology-content">
    <p className="methodology-kicker">Dog adoption guide</p>
    <h1>How to adopt a dog</h1>
    <p className="methodology-lede">To adopt a dog, confirm you can meet a dog's needs, search shelters and rescues for adoptable dogs, visit to ask questions, complete an application, prepare your home, and plan for the first two weeks. Pawline helps you discover adoptable pets and adoption events before you contact the shelter.</p>
    <p>Prepared by Pawline · Reviewed <time dateTime="2026-10-27">October 27, 2026</time></p>

    <section aria-labelledby="step-1"><h2 id="step-1">1. Decide if you're ready for a dog</h2>
      <p>Consider your daily schedule, living situation, and budget. Dogs need time, attention, exercise, training, and veterinary care throughout their lives. According to the <a href="https://www.aspca.org/adopt-pet/adoption-tips">ASPCA adoption tips</a>, typical dog ownership costs include food, supplies, veterinary care, training, and emergency expenses.</p>
      <p>Be realistic about your routine and household composition. Think about whether your home allows pets, whether your landlord has restrictions, and how a dog fits with children or other animals already in your household.</p>
    </section>

    <section aria-labelledby="step-2"><h2 id="step-2">2. Find adoptable dogs near you</h2>
      <p>Search local animal shelters, rescue organizations, and adoption events. Many organizations list available dogs on their websites and through adoption platforms. Pawline helps you <a href={standalone ? "/guides/find-adoptable-pets-near-you" : "#guides/nearby"}>discover adoptable pets near you</a> by showing current shelter listings on an interactive map.</p>
      <p>Read each listing carefully and check the record class. Provider-backed listings and reviewed records have confirmed sources, while approximate web leads require verification. Save the source URL and animal ID from the original listing, not just a screenshot.</p>
      <p>Explore <a href={standalone ? "/events" : "#events"}>adoption events</a> in your area where you can meet multiple dogs in person and talk directly with shelter staff or rescue volunteers.</p>
    </section>

    <section aria-labelledby="step-3"><h2 id="step-3">3. Visit and ask questions</h2>
      <p>Contact the shelter or rescue to confirm the dog is still available and to schedule a visit. Bring a list of questions about the dog's health, behavior, daily routine, and care requirements. Use a <a href={standalone ? "/guides/questions-to-ask-before-adopting" : "#guides/checklist"}>practical shelter visit checklist</a> to prepare for your conversation.</p>
      <p>Ask about the dog's experience with children, other animals, and strangers. Confirm what is known and what is still unknown. Discuss your household, routine, and any concerns with the shelter staff to ensure a good match.</p>
      <p>If possible, spend time with the dog before applying. Some organizations allow multiple visits or trial periods to help you make an informed decision.</p>
    </section>

    <section aria-labelledby="step-4"><h2 id="step-4">4. Complete the application and home check</h2>
      <p>Fill out the adoption application honestly and completely. Shelters and rescues ask about your living situation, household members, pet experience, and how you plan to care for the dog. Provide references when requested.</p>
      <p>Many organizations require a home visit to ensure your living space is safe and suitable for the dog. Prepare your home in advance and be ready to answer questions about your daily routine and pet care plans.</p>
      <p>Application processing times vary by organization. Some approve applications quickly, while others may take days or weeks depending on their review process and the dog's specific needs.</p>
    </section>

    <section aria-labelledby="step-5"><h2 id="step-5">5. Pay fees and complete paperwork</h2>
      <p>Adoption fees typically cover spaying or neutering, vaccinations, microchipping, and initial veterinary care. The <a href="https://www.aspca.org/adopt-pet/adoption-tips">ASPCA notes</a> that fees vary by organization and the dog's age and medical history.</p>
      <p>Review and sign the adoption contract. This document outlines your responsibilities as an adopter and any conditions set by the organization. Read the contract carefully and ask questions about any terms you don't understand.</p>
      <p>Collect copies of the dog's medical records, vaccination history, and any behavioral notes. Schedule a veterinary visit within the first week to establish care and discuss the dog's health needs.</p>
    </section>

    <section aria-labelledby="step-6"><h2 id="step-6">6. Prepare your home</h2>
      <p>Before bringing your dog home, gather essential supplies: food and water bowls, quality dog food recommended by the shelter, a collar with ID tags, a leash, a bed or crate, and safe toys. Set up a designated area where your dog can eat, sleep, and feel secure.</p>
      <p>Remove hazards like toxic plants, small objects, and unsecured trash cans. Secure fences and gates if you have a yard. Consider puppy-proofing even if you're adopting an adult dog, as new dogs may explore unfamiliar spaces.</p>
      <p>Establish a routine before your dog arrives. Plan feeding times, potty breaks, walks, and quiet time. Consistency helps dogs adjust to their new environment and build trust.</p>
    </section>

    <section aria-labelledby="step-7"><h2 id="step-7">7. Plan for the first two weeks</h2>
      <p>The first two weeks are crucial for bonding and establishing routines. Keep your schedule predictable, minimize big changes, and give your dog time to adjust. Some dogs settle in quickly, while others need more time to feel comfortable.</p>
      <p>Watch for signs of stress or anxiety and be patient. Avoid overwhelming your dog with too many new people or experiences at once. Gradually introduce new activities, training, and socialization as your dog becomes more confident.</p>
      <p>Schedule a veterinary checkup within the first week. Discuss spaying or neutering if not already completed, vaccination updates, parasite prevention, and any behavioral or health concerns you observe.</p>
    </section>

    <section aria-labelledby="first-time-checklist"><h2 id="first-time-checklist">First-time dog owner checklist</h2>
      <p>If you're adopting your first dog, use this checklist to prepare:</p>
      <ul>
        <li><strong>Budget:</strong> Confirm you can cover food, supplies, routine veterinary care, emergency expenses, and training costs.</li>
        <li><strong>Time commitment:</strong> Plan for daily walks, playtime, training, grooming, and companionship throughout the dog's life.</li>
        <li><strong>Living situation:</strong> Verify your lease or housing rules allow dogs and confirm any breed or size restrictions.</li>
        <li><strong>Exercise needs:</strong> Match the dog's energy level and exercise requirements with your daily routine and activity level.</li>
        <li><strong>Training plan:</strong> Research positive reinforcement training methods or consider enrolling in a training class early on.</li>
        <li><strong>Support network:</strong> Identify a veterinarian, backup pet care if you travel, and resources for questions or emergencies.</li>
        <li><strong>Long-term commitment:</strong> Understand that dogs can live 10 to 15 years or more and require consistent care throughout their lives.</li>
      </ul>
      <p>Use Pawline to <a href={standalone ? "/guides/find-a-pet-that-fits-your-home-and-routine" : "#guides/matching"}>compare your home and routine with available dogs</a> before visiting a shelter. This helps you identify which questions to ask and which unknowns to confirm in person.</p>
    </section>

    <section aria-labelledby="faq"><h2 id="faq">Frequently asked questions about dog adoption</h2>
      <dl className="faq-list">
        {faqItems.map((item, index) => <div key={index} className="faq-item">
          <dt><strong>{item.question}</strong></dt>
          <dd>{item.answer}</dd>
        </div>)}
      </dl>
    </section>

    <section className="methodology-next" aria-labelledby="next-heading">
      <h2 id="next-heading">Start exploring adoptable dogs</h2>
      <p>Browse current shelter listings on the Pawline map, check the source, and contact the shelter or rescue to confirm availability. Learn more about <a href={standalone ? "/how-pawline-works" : "#how-pawline-works"}>how Pawline verifies adoption listings</a>.</p>
      <a href={standalone ? "/#map" : "#map"}>Find adoptable pets near you <span aria-hidden="true">→</span></a>
    </section>
  </article></section>;
}
