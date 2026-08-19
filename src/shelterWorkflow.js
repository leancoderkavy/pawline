// This module intentionally has no React or server-only dependencies: both the
// shelter API and workspace use the same finite state graph.
export const SHELTER_STATUS_LABELS = Object.freeze({
  draft: "Draft",
  awaiting_participation: "Awaiting participation",
  submitted: "Submitted",
  reviewing: "Reviewing",
  follow_up_needed: "Follow-up needed",
  meet_and_greet: "Meet-and-greet",
  approved: "Approved",
  declined: "Closed",
  withdrawn: "Withdrawn",
  adoption_pending: "Adoption pending",
  adopted: "Adopted",
  expired: "Expired",
});

export const SHELTER_NEXT_STATUSES = Object.freeze({
  submitted: Object.freeze(["reviewing", "follow_up_needed", "declined"]),
  reviewing: Object.freeze(["follow_up_needed", "meet_and_greet", "declined"]),
  follow_up_needed: Object.freeze(["reviewing", "meet_and_greet", "declined"]),
  meet_and_greet: Object.freeze(["approved", "declined"]),
  approved: Object.freeze(["adoption_pending", "declined"]),
  adoption_pending: Object.freeze([]),
  declined: Object.freeze([]),
  adopted: Object.freeze([]),
  withdrawn: Object.freeze([]),
  expired: Object.freeze([]),
  draft: Object.freeze([]),
  awaiting_participation: Object.freeze([]),
});

export function validShelterTransition(from, to) {
  return SHELTER_NEXT_STATUSES[from]?.includes(to) || false;
}
