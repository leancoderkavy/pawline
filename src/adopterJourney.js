export const APPLICATION_STATUS = {
  draft: { label: "Draft", tone: "neutral" },
  awaiting_participation: { label: "Awaiting shelter participation", tone: "notice" },
  submitted: { label: "Submitted", tone: "active" },
  reviewing: { label: "Reviewing", tone: "active" },
  follow_up_needed: { label: "Follow-up needed", tone: "notice" },
  meet_and_greet: { label: "Meet-and-greet", tone: "active" },
  approved: { label: "Approved", tone: "positive" },
  declined: { label: "Closed", tone: "neutral" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
  adoption_pending: { label: "Adoption pending", tone: "positive" },
  adopted: { label: "Adopted", tone: "positive" },
};

export const JOURNEY_STEPS = ["Profile", "Discover", "Application", "Meet", "Welcome home"];

export const PROFILE_FIELDS = [
  { key: "species", label: "I am hoping to adopt", options: ["Either", "Dog", "Cat"] },
  { key: "home", label: "Home", options: ["", "Apartment or condo", "House", "Townhome or duplex", "Other"] },
  { key: "energy", label: "Ideal pace", options: ["", "Calm", "Balanced", "Active"] },
  { key: "kids", label: "Children at home", options: ["", "Yes", "No"] },
  { key: "pets", label: "Resident animals", options: ["", "None", "Dogs", "Cats", "Dogs and cats"] },
  { key: "alone", label: "Time alone", options: ["", "Rarely", "Sometimes", "Often"] },
  { key: "experience", label: "Pet experience", options: ["", "First-time adopter", "Some experience", "Very experienced"] },
];

export const DEFAULT_PROFILE = {
  species: "Either",
  home: "",
  energy: "",
  kids: "",
  pets: "",
  alone: "",
  experience: "",
  householdName: "",
  collaborators: [],
  distance: "25",
  accessibility: "",
};

const normalize = value => String(value || "").trim();

export function normalizeAdopterProfile(input = {}) {
  return {
    ...DEFAULT_PROFILE,
    ...Object.fromEntries(Object.keys(DEFAULT_PROFILE).map(key => [
      key,
      Array.isArray(DEFAULT_PROFILE[key]) ? input[key] || [] : normalize(input[key]) || DEFAULT_PROFILE[key],
    ])),
  };
}

export function profileReadiness(profile = {}) {
  const normalized = normalizeAdopterProfile(profile);
  const required = ["home", "energy", "kids", "pets", "alone", "experience"];
  const complete = required.filter(key => Boolean(normalized[key]));
  return {
    complete: complete.length,
    total: required.length,
    missing: required.filter(key => !normalized[key]),
    percent: Math.round((complete.length / required.length) * 100),
  };
}

export function applicationStatus(status) {
  return APPLICATION_STATUS[status] || APPLICATION_STATUS.draft;
}

export function createApplicationDraft(pet = {}, profile = {}) {
  return {
    id: `local-${Date.now()}`,
    petId: String(pet.id || ""),
    petName: normalize(pet.name) || "This pet",
    shelter: normalize(pet.shelter) || "the listed organization",
    organizationId: pet.organization_id || pet.organizationId || null,
    organizationClaimed: Boolean(pet.organizationClaimed || pet.organization_claimed),
    sourceUrl: safeHttpUrl(pet.sourceUrl || pet.source_url),
    status: "draft",
    coreAnswers: {
      household: normalize(profile.householdName),
      carePlan: "",
      schedule: "",
      notes: "",
    },
    addOnAnswers: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function nextApplicationStatus(application) {
  // A client draft never becomes submitted locally. Only a confirmed server
  // response may advance this status after it has persisted the application.
  return application?.status || "draft";
}

export function safeHttpUrl(value) {
  const candidate = normalize(value);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export function buildApplicationCoachRequest({ question, answer, consentToAiProcessing }) {
  const safeQuestion = normalize(question).slice(0, 400);
  const safeAnswer = normalize(answer).slice(0, 1200);
  if (consentToAiProcessing !== true) return { error: "Consent is required before requesting an AI suggestion." };
  if (!safeQuestion || !safeAnswer) return { error: "Add a question and an answer before requesting a suggestion." };
  if (containsDirectContactDetails(safeAnswer)) {
    return { error: "Remove email addresses, phone numbers, or street addresses before using the AI helper." };
  }
  return {
    value: {
      task: "application_coach",
      schemaVersion: 1,
      consentToAiProcessing: true,
      question: safeQuestion,
      answer: safeAnswer,
    },
  };
}

export function containsDirectContactDetails(value) {
  const text = normalize(value);
  return /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/i.test(text) ||
    /(?:\+?\d[\d\s().-]{7,}\d)/.test(text) ||
    /\b\d{1,6}\s+[A-Za-z][A-Za-z.'-]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct)\b/i.test(text);
}

export function validateApplicationCoachSuggestion(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const suggestion = normalize(payload.suggestion).slice(0, 1600);
  const explanation = normalize(payload.explanation).slice(0, 600);
  const missingDetails = Array.isArray(payload.missingDetails)
    ? payload.missingDetails.map(item => normalize(item).slice(0, 180)).filter(Boolean).slice(0, 4)
    : [];
  const prohibited = /\b(approval|approve|approved|decline|declined|score|rank(?:ing)?|probability|chance|guarantee|bypass|work around|hide|omit|leave out|best applicant)\b/i;
  if (!suggestion || !explanation || prohibited.test(`${suggestion}\n${explanation}\n${missingDetails.join("\n")}`)) return null;
  return { suggestion, explanation, missingDetails };
}

export function manualCoachGuidance(answer) {
  const words = normalize(answer).split(/\s+/).filter(Boolean).length;
  if (words < 25) return "Add a concrete example from your routine, such as when the pet will be fed, exercised, or cared for.";
  if (!/[.!?]$/.test(normalize(answer))) return "Read the answer aloud, then add a clear ending that describes the care you can personally provide.";
  return "Check that this is truthful, specific to your household, and answers the shelter’s question directly.";
}
