export const ANY_LIFESTYLE = "Any lifestyle";

const normalize = (value) => String(value || "").trim().toLowerCase();
const includesAny = (text, terms) => terms.some((term) => text.includes(term));

const TRAITS = {
  active: ["active", "energetic", "hiking", "runner", "high energy", "playful"],
  calm: ["calm", "quiet", "couch", "gentle", "low energy", "laid-back", "laid back"],
  kids: ["good with children", "good with kids", "kid friendly", "family friendly"],
  noKids: ["no children", "no kids", "adult-only", "adult only"],
  dogs: ["good with dogs", "dog friendly", "lived with dogs"],
  cats: ["good with cats", "cat friendly", "lived with cats"],
  experienced: ["experienced adopter", "experienced owner", "needs training", "resource guarding"],
  alone: ["independent", "does well alone", "can be left alone"],
};

function petText(pet) {
  return normalize([
    pet.description,
    pet.name,
    pet.breed,
    pet.age,
    pet.size,
    ...(pet.lifestyles || []),
  ].filter(Boolean).join(" "));
}

function knownTrait(text, positive, negative = []) {
  if (includesAny(text, TRAITS[positive])) return true;
  if (negative.length && includesAny(text, negative)) return false;
  return null;
}

export function scorePet(pet, answers = {}) {
  const text = petText(pet);
  let earned = 0;
  let possible = 0;
  const reasons = [];
  const considerations = [];
  const questions = [];
  const add = (weight, result, reason, consideration, question) => {
    possible += weight;
    if (result === true) {
      earned += weight;
      if (reason) reasons.push(reason);
    } else if (result === false) {
      if (consideration) considerations.push(consideration);
    } else {
      earned += weight * 0.55;
      if (question) questions.push(question);
    }
  };

  if (answers.species && answers.species !== "Either") {
    add(24, pet.species === answers.species, null, null, null);
  }

  const size = normalize(pet.size);
  if (answers.home === "Apartment or condo") {
    add(12, size ? includesAny(size, ["small", "medium"]) : null,
      `${pet.size} size can be easier to accommodate in an apartment.`,
      `${pet.size || "This pet's"} size may need more room than your home offers.`,
      "Ask whether this pet is comfortable in an apartment.");
  } else if (answers.home) {
    add(8, true, "Your home type does not create an obvious size conflict.", null, null);
  }

  const active = knownTrait(text, "active");
  const calm = knownTrait(text, "calm");
  if (answers.energy === "Active") {
    add(18, active, "The listing describes an active, playful companion.",
      "The listing suggests a calmer pace than you selected.",
      "Ask the shelter about daily exercise needs.");
  } else if (answers.energy === "Calm") {
    add(18, calm, "The listing describes a calm, lower-key companion.",
      active ? "This pet may need more daily activity than you selected." : null,
      "Ask the shelter about daily exercise needs.");
  } else if (answers.energy) {
    add(12, active || calm || null, "The listing includes useful energy-level information.", null,
      "Ask the shelter about daily exercise needs.");
  }

  if (answers.kids === "Yes") {
    add(16, knownTrait(text, "kids", TRAITS.noKids),
      "The listing says this pet may do well with children.",
      "The listing indicates an adult-only home.",
      "Ask whether this pet has been evaluated with children.");
  }

  if (answers.pets === "Dogs") {
    add(12, knownTrait(text, "dogs"), "The listing mentions compatibility with dogs.", null,
      "Ask whether this pet has been evaluated with dogs.");
  } else if (answers.pets === "Cats") {
    add(12, knownTrait(text, "cats"), "The listing mentions compatibility with cats.", null,
      "Ask whether this pet has been evaluated with cats.");
  } else if (answers.pets === "Dogs and cats") {
    const withDogs = knownTrait(text, "dogs");
    const withCats = knownTrait(text, "cats");
    add(12, withDogs && withCats ? true : withDogs === false || withCats === false ? false : null,
      "The listing mentions compatibility with dogs and cats.", null,
      "Ask whether this pet has been evaluated with both dogs and cats.");
  }

  if (answers.alone === "Often") {
    add(10, knownTrait(text, "alone"), "The listing describes a more independent pet.", null,
      "Ask how this pet handles time alone.");
  }

  if (answers.experience === "First-time adopter") {
    const needsExperience = knownTrait(text, "experienced");
    add(8, needsExperience === null ? null : !needsExperience,
      "The listing does not flag advanced handling needs.",
      "The listing may call for an experienced adopter.",
      "Ask whether this pet is suitable for a first-time adopter.");
  }

  const score = possible ? Math.round((earned / possible) * 100) : 70;
  return {
    pet,
    score: Math.max(35, Math.min(98, score)),
    reasons: reasons.slice(0, 2),
    considerations: considerations.slice(0, 1),
    questions: questions.slice(0, 2),
  };
}

export function rankPets(pets, answers = {}) {
  return pets
    .filter((pet) => !answers.species || answers.species === "Either" || pet.species === answers.species)
    .map((pet) => scorePet(pet, answers))
    .sort((left, right) => right.score - left.score || Number(left.pet.distance || 0) - Number(right.pet.distance || 0));
}

export function matchPets(pets, { species = "All", lifestyle = ANY_LIFESTYLE, location = "" } = {}) {
  const locationTerm = normalize(location).split(",")[0];
  const filtered = pets.filter((pet) => {
    if (species !== "All" && pet.species !== species) return false;
    if (lifestyle === ANY_LIFESTYLE) return true;
    return Array.isArray(pet.lifestyles) && pet.lifestyles.includes(lifestyle);
  });

  return [...filtered].sort((left, right) => {
    const leftLocal = locationTerm && normalize(left.city).includes(locationTerm) ? 1 : 0;
    const rightLocal = locationTerm && normalize(right.city).includes(locationTerm) ? 1 : 0;
    if (leftLocal !== rightLocal) return rightLocal - leftLocal;
    return Number(left.distance || 0) - Number(right.distance || 0);
  });
}
