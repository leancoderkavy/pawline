export const ANY_LIFESTYLE = "Any lifestyle";

const normalize = (value) => String(value || "").trim().toLowerCase();

const TRAITS = {
  active: ["active", "energetic", "hiking", "runner", "high energy", "playful"],
  calm: ["calm", "quiet", "couch", "gentle", "low energy", "laid-back", "laid back"],
  kids: ["good with children", "good with kids", "kid friendly", "family friendly"],
  noKids: ["no children", "no kids", "adult-only", "adult only"],
  dogs: ["good with dogs", "dog friendly", "lived with dogs"],
  cats: ["good with cats", "cat friendly", "lived with cats"],
  experienced: ["experienced adopter", "experienced owner", "resource guarding"],
  alone: ["independent", "does well alone", "can be left alone"],
};

function petText(pet) {
  return normalize([
    pet.description,
    ...(pet.lifestyles || []),
  ].filter(Boolean).join(" "));
}

function knownTrait(text, positive, negative = []) {
  const terms = TRAITS[positive];
  // A negative or uncertain statement must never become compatibility evidence.
  if (negative.some(term => text.includes(term))) return false;
  let supported = false;
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}\\b`, "g");
    for (const match of text.matchAll(pattern)) {
      const before = text.slice(Math.max(0, match.index - 55), match.index).split(/[.!?;\n]/).pop();
      if (/\b(no|not|never|isn't|is not|cannot|can't|doesn't)\b(?:\W+\w+){0,3}\W*$/.test(before)) return false;
      if (/\b(unknown|unsure|whether|may|might|possibly)\b[^.!?;]*$/.test(before)) continue;
      supported = true;
    }
  }
  return supported ? true : null;
}

function distanceValue(pet) {
  if (pet.distance == null || String(pet.distance).trim() === "") return Infinity;
  const distance = Number(pet.distance);
  return Number.isFinite(distance) && distance >= 0 ? distance : Infinity;
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
      if (question) questions.push(question);
    }
  };

  if (answers.species && answers.species !== "Either") {
    add(24, pet.species === answers.species, null, null, null);
  }

  if (answers.home) {
    add(12, null, null, null,
      "Ask about exercise, noise, space needs, and your housing rules; size alone does not establish home suitability.");
  }

  const active = knownTrait(text, "active");
  const calm = knownTrait(text, "calm");
  if (answers.energy === "Active") {
    add(18, active === null && calm === true ? false : active, "The listing describes an active, playful companion.",
      "The listing suggests a calmer pace than you selected.",
      "Ask the shelter about daily exercise needs.");
  } else if (answers.energy === "Calm") {
    add(18, calm === null && active === true ? false : calm, "The listing describes a calm, lower-key companion.",
      "The listing may not support the calmer pace you selected.",
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
    add(12, knownTrait(text, "dogs", ["no dogs", "only dog", "dog-free"]), "The listing mentions compatibility with dogs.", "The listing indicates a possible conflict with resident dogs.",
      "Ask whether this pet has been evaluated with dogs.");
  } else if (answers.pets === "Cats") {
    add(12, knownTrait(text, "cats", ["no cats", "cat-free"]), "The listing mentions compatibility with cats.", "The listing indicates a possible conflict with resident cats.",
      "Ask whether this pet has been evaluated with cats.");
  } else if (answers.pets === "Dogs and cats") {
    const withDogs = knownTrait(text, "dogs", ["no dogs", "only dog", "dog-free"]);
    const withCats = knownTrait(text, "cats", ["no cats", "cat-free"]);
    add(12, withDogs && withCats ? true : withDogs === false || withCats === false ? false : null,
      "The listing mentions compatibility with dogs and cats.", "The listing indicates a possible conflict with resident animals.",
      "Ask whether this pet has been evaluated with both dogs and cats.");
  }

  if (answers.alone === "Often") {
    add(10, knownTrait(text, "alone"), "The listing describes a more independent pet.", "The listing suggests this pet may need company or support when alone.",
      "Ask how this pet handles time alone.");
  }

  if (answers.experience === "First-time adopter") {
    const needsExperience = knownTrait(text, "experienced");
    add(8, needsExperience === null ? null : !needsExperience,
      "The listing does not flag advanced handling needs.",
      "The listing may call for an experienced adopter.",
      "Ask whether this pet is suitable for a first-time adopter.");
  }

  const score = possible ? Math.round((earned / possible) * 100) : 0;
  return {
    pet,
    score,
    reasons,
    considerations,
    questions,
  };
}

export function rankPets(pets, answers = {}) {
  return pets
    .filter((pet) => !answers.species || answers.species === "Either" || pet.species === answers.species)
    .map((pet) => scorePet(pet, answers))
    .sort((left, right) => left.considerations.length - right.considerations.length || right.score - left.score || distanceValue(left.pet) - distanceValue(right.pet));
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
    return distanceValue(left) - distanceValue(right);
  });
}
