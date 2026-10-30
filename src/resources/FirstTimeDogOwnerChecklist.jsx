const faqItems = [
  {
    question: "What supplies do I need before getting a dog?",
    answer: "Essential supplies include food and water bowls, quality dog food, a collar with ID tags, a leash, a comfortable bed or crate, safe chew toys, grooming supplies, and cleaning materials. Have these ready before bringing your dog home."
  },
  {
    question: "How much does it cost to own a dog in the first year?",
    answer: "First-year costs typically range from $1,000 to $2,000 according to the ASPCA. This includes adoption fees, initial veterinary care (spaying/neutering, vaccinations, microchip), supplies, food, training, and preventive medications. Budget for ongoing annual costs of $500 to $1,000 for food, routine care, and supplies."
  },
  {
    question: "How much time does a dog need each day?",
    answer: "Most dogs need at least 1-2 hours of active attention daily, including walks, playtime, training, grooming, and companionship. Puppies and high-energy breeds may need more. Consider your daily schedule before adopting."
  },
  {
    question: "What training should I plan for a new dog?",
    answer: "Basic obedience training (sit, stay, come, down, leash walking) is essential for all dogs. House training is critical if adopting a puppy or untrained adult. Consider enrolling in a positive reinforcement training class within the first few weeks. Consistent daily training sessions of 5-10 minutes work well."
  },
  {
    question: "How do I find a good veterinarian?",
    answer: "Ask for recommendations from local shelters, pet owners, or online reviews. Schedule a new patient visit before adopting if possible, or within the first week after bringing your dog home. Confirm the clinic's hours, emergency coverage, and services offered."
  },
  {
    question: "Can I adopt a dog if I work full time?",
    answer: "Yes, many people successfully adopt dogs while working full time. Choose a dog whose energy level and needs match your schedule. Plan for exercise before and after work, consider a dog walker or daycare for midday breaks, and ensure your dog has mental stimulation while you're away."
  },
];

export default function FirstTimeDogOwnerChecklist({ standalone = false }) {
  return <section className="methodology-page guide-page"><article className="methodology-content">
    <p className="methodology-kicker">First-time owner guide</p>
    <h1>First time dog owner checklist</h1>
    <p className="methodology-lede">Use this first-time dog owner checklist to confirm you're ready for the time, financial, and long-term commitment of dog ownership, and to prepare your home, supplies, and support network before bringing your new companion home.</p>
    <p>Prepared by Pawline · Reviewed <time dateTime="2026-10-30">October 30, 2026</time></p>

    <section aria-labelledby="readiness-checklist"><h2 id="readiness-checklist">Am I ready for a dog?</h2>
      <p>Before adopting, honestly assess whether your current situation supports responsible dog ownership. Use this checklist to evaluate your readiness:</p>
      <ul>
        <li><strong>Daily time commitment:</strong> Can you provide 1-2 hours daily for walks, playtime, training, feeding, grooming, and companionship? Dogs are social animals and need consistent attention.</li>
        <li><strong>Financial budget:</strong> Can you afford $1,000 to $2,000 in first-year costs (adoption fee, initial vet care, supplies, training), plus $500 to $1,000 annually for food, routine care, and preventive medications? Emergency veterinary care can cost hundreds to thousands of dollars.</li>
        <li><strong>Living situation:</strong> Does your lease or housing allow dogs? Are there breed, size, or weight restrictions? Do you have adequate indoor space and safe outdoor access?</li>
        <li><strong>Long-term stability:</strong> Can you commit for 10 to 15+ years? Consider potential life changes like moves, job changes, relationships, or children.</li>
        <li><strong>Household agreement:</strong> Do all household members support adopting a dog and understand the responsibilities? Are there allergies or concerns to address first?</li>
        <li><strong>Exercise capacity:</strong> Can you provide daily exercise appropriate to the dog's breed and energy level, regardless of weather or your schedule?</li>
        <li><strong>Training commitment:</strong> Are you prepared to invest time in house training, basic obedience, and socialization? All dogs benefit from consistent, positive reinforcement training.</li>
      </ul>
      <p>If you answered no to any of these questions, consider whether you can address those concerns before adopting, or whether fostering or volunteering at a shelter might be a better fit right now.</p>
    </section>

    <section aria-labelledby="choosing-first-dog"><h2 id="choosing-first-dog">Choosing your first dog</h2>
      <p>Not all dogs are equally suited for first-time owners. Consider these factors when searching for your first dog:</p>
      <ul>
        <li><strong>Age:</strong> Adult dogs (1-5 years) are often easier for first-time owners than puppies. They typically have established house training and calmer energy levels. Senior dogs (7+ years) can be wonderful, low-maintenance companions.</li>
        <li><strong>Size:</strong> Smaller dogs are generally easier to handle physically and may have lower food and medication costs. However, temperament matters more than size alone.</li>
        <li><strong>Energy level:</strong> Match the dog's energy to your lifestyle. High-energy working breeds need extensive daily exercise and mental stimulation. Moderate or low-energy dogs suit less active households.</li>
        <li><strong>Temperament:</strong> Look for dogs described as friendly, adaptable, trainable, and confident. Ask shelter staff about the dog's behavior with people, other animals, and in different environments.</li>
        <li><strong>Health needs:</strong> Be realistic about special medical or behavioral needs. Some conditions require ongoing medication, training, or management that may challenge first-time owners.</li>
        <li><strong>Breed characteristics:</strong> Research breed tendencies (energy, trainability, grooming needs, common health issues), but remember that individual dogs vary. Mixed breeds can make excellent first dogs.</li>
      </ul>
      <p>Visit <a href={standalone ? "/" : "#map"}>Pawline's adoption map</a> to explore adoptable dogs near you, and use the <a href={standalone ? "/guides/find-a-pet-that-fits-your-home-and-routine" : "#guides/matching"}>matching guide</a> to compare disclosed needs with your household and routine.</p>
    </section>

    <section aria-labelledby="supplies-checklist"><h2 id="supplies-checklist">Essential supplies checklist</h2>
      <p>Gather these items before bringing your dog home:</p>
      <h3>Food and water</h3>
      <ul>
        <li>Food and water bowls (stainless steel or ceramic recommended)</li>
        <li>High-quality dog food (ask the shelter what the dog is currently eating and transition gradually to avoid stomach upset)</li>
        <li>Treats for training and rewards</li>
      </ul>
      <h3>Safety and identification</h3>
      <ul>
        <li>Collar with ID tags showing your current phone number and address</li>
        <li>Leash (4-6 feet for everyday walks; avoid retractable leashes initially)</li>
        <li>Harness (optional but helpful for dogs that pull on leash)</li>
        <li>Microchip registration (most adopted dogs come microchipped; update the contact information)</li>
      </ul>
      <h3>Comfort and rest</h3>
      <ul>
        <li>Dog bed or crate sized appropriately for your dog</li>
        <li>Blankets or bedding</li>
        <li>Crate training supplies if you plan to crate train</li>
      </ul>
      <h3>Play and enrichment</h3>
      <ul>
        <li>Safe chew toys in varied textures</li>
        <li>Interactive toys for mental stimulation (puzzle feeders, treat-dispensing toys)</li>
        <li>Balls or fetch toys if your dog enjoys fetch</li>
      </ul>
      <h3>Grooming and hygiene</h3>
      <ul>
        <li>Brush or comb appropriate for your dog's coat type</li>
        <li>Dog shampoo for occasional baths</li>
        <li>Nail clippers or grinder (or plan for professional nail trims)</li>
        <li>Toothbrush and dog toothpaste for dental care</li>
      </ul>
      <h3>Cleaning and accidents</h3>
      <ul>
        <li>Enzymatic cleaner for accidents (essential for house training)</li>
        <li>Poop bags and dispenser for walks</li>
        <li>Paper towels and cleaning supplies</li>
      </ul>
      <h3>Health and safety</h3>
      <ul>
        <li>First aid kit for pets</li>
        <li>Flea, tick, and heartworm preventive medications (after veterinary consultation)</li>
      </ul>
    </section>

    <section aria-labelledby="home-preparation"><h2 id="home-preparation">Preparing your home</h2>
      <p>Before your dog arrives, make your home safe and comfortable:</p>
      <ul>
        <li><strong>Remove hazards:</strong> Secure toxic plants, chemicals, medications, and small objects dogs could swallow. Use baby gates to restrict access to certain areas.</li>
        <li><strong>Secure outdoor spaces:</strong> Check fences and gates for gaps or weak spots. Ensure your yard is escape-proof and free of toxic plants or hazardous materials.</li>
        <li><strong>Designate a dog area:</strong> Set up a specific space where your dog will eat, sleep, and feel secure. This helps with house training and provides a safe retreat.</li>
        <li><strong>Protect belongings:</strong> Store shoes, clothes, books, and valuables out of reach. Puppies and new dogs may chew while exploring or when anxious.</li>
        <li><strong>Plan a potty area:</strong> Identify where you want your dog to eliminate (backyard spot, nearby outdoor area) and plan to take them there consistently.</li>
      </ul>
    </section>

    <section aria-labelledby="support-network"><h2 id="support-network">Building your support network</h2>
      <p>Establish a support network before bringing your dog home:</p>
      <ul>
        <li><strong>Find a veterinarian:</strong> Research local veterinary clinics, read reviews, and schedule a new patient visit within the first week of bringing your dog home.</li>
        <li><strong>Identify a trainer:</strong> Look for positive reinforcement trainers or obedience classes in your area. Early training sets you both up for success.</li>
        <li><strong>Arrange backup care:</strong> Identify friends, family, or professional pet sitters who can help if you're sick, traveling, or have an emergency.</li>
        <li><strong>Connect with other dog owners:</strong> Join local dog parks, walking groups, or online communities for advice, socialization opportunities, and support.</li>
        <li><strong>Locate emergency services:</strong> Know where the nearest 24-hour emergency veterinary clinic is located and keep contact information easily accessible.</li>
      </ul>
    </section>

    <section aria-labelledby="first-days"><h2 id="first-days">The first days and weeks</h2>
      <p>Bringing home a new dog is exciting but can be overwhelming for both of you. Follow these tips for a smooth transition:</p>
      <ul>
        <li><strong>Establish routines immediately:</strong> Feed, walk, and take your dog out for potty breaks at consistent times each day. Dogs thrive on predictable schedules.</li>
        <li><strong>Be patient with house training:</strong> Accidents are normal, especially in the first few weeks. Use positive reinforcement when your dog eliminates in the right place, and clean accidents thoroughly with enzymatic cleaner.</li>
        <li><strong>Limit introductions:</strong> Don't overwhelm your dog with too many new people, places, or experiences at once. Let them settle in for a few days before expanding their world.</li>
        <li><strong>Start training early:</strong> Begin basic training (sit, come, name recognition) within the first few days using treats and positive reinforcement. Keep sessions short (5-10 minutes) and fun.</li>
        <li><strong>Schedule a vet visit:</strong> Book an appointment within the first week to establish care, discuss vaccinations, parasite prevention, and address any health questions.</li>
        <li><strong>Monitor behavior and health:</strong> Watch for signs of stress, illness, or injury. Contact your vet if you notice concerning changes in appetite, energy, bathroom habits, or behavior.</li>
        <li><strong>Be prepared for adjustment time:</strong> The &quot;rule of 3s&quot; suggests dogs take 3 days to decompress, 3 weeks to learn your routine, and 3 months to fully settle. Give your dog time to adjust at their own pace.</li>
      </ul>
      <p>Read our full guide on <a href={standalone ? "/guides/how-to-adopt-a-dog" : "#guides/how-to-adopt"}>how to adopt a dog</a> for step-by-step guidance from deciding readiness through the adoption process and first weeks at home.</p>
    </section>

    <section aria-labelledby="common-mistakes"><h2 id="common-mistakes">Common first-time owner mistakes to avoid</h2>
      <ul>
        <li><strong>Skipping training:</strong> Even well-behaved shelter dogs benefit from consistent training in their new home. Don't assume they'll &quot;figure it out.&quot;</li>
        <li><strong>Inconsistent rules:</strong> Decide on house rules (furniture access, feeding from table, jumping) and enforce them consistently from day one.</li>
        <li><strong>Over-exercising or under-exercising:</strong> Match exercise to your dog's age, breed, and energy level. Too much can cause injury; too little can lead to destructive behavior.</li>
        <li><strong>Ignoring socialization:</strong> Expose your dog gradually to different people, places, and situations (once vaccinated) to build confidence and prevent fear or aggression.</li>
        <li><strong>Delaying vet care:</strong> Don't skip the initial checkup or delay care when something seems wrong. Early intervention prevents bigger problems.</li>
        <li><strong>Giving up too soon:</strong> Behavior issues often improve with time, training, and patience. Reach out to your shelter, trainer, or vet for help before considering rehoming.</li>
      </ul>
    </section>

    <section aria-labelledby="faq"><h2 id="faq">Frequently asked questions for first-time dog owners</h2>
      <dl className="faq-list">
        {faqItems.map((item, index) => <div key={index} className="faq-item">
          <dt><strong>{item.question}</strong></dt>
          <dd>{item.answer}</dd>
        </div>)}
      </dl>
    </section>

    <section className="methodology-next" aria-labelledby="next-heading">
      <h2 id="next-heading">Start your search</h2>
      <p>Ready to find your first dog? Use Pawline to discover adoptable dogs, compare their needs with your household, and prepare your questions before contacting the shelter.</p>
      <a className="button-primary" href={standalone ? "/" : "#map"}>Search adoptable dogs near you</a>
      <p>Or continue learning:</p>
      <ul>
        <li><a href={standalone ? "/guides/how-to-adopt-a-dog" : "#guides/how-to-adopt"}>How to adopt a dog</a> — Full step-by-step guidance</li>
        <li><a href={standalone ? "/guides/questions-to-ask-before-adopting" : "#guides/checklist"}>Questions to ask before adopting</a> — Shelter visit checklist</li>
        <li><a href={standalone ? "/guides/find-a-pet-that-fits-your-home-and-routine" : "#guides/matching"}>Find a pet that fits your home</a> — Compare needs with your routine</li>
      </ul>
    </section>
  </article></section>;
}
