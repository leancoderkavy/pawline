// Feed observation is not an availability confirmation from shelter staff.
export function resultFreshness(pet, now = Date.now()) {
  if (pet.status && pet.status !== "available") return "Status needs confirmation";
  const value = pet.lastObservedAt || pet.verified_at || pet.verifiedAt;
  const timestamp = typeof value === "string" && value.trim() ? Date.parse(value) : NaN;
  const age = now - timestamp;
  if (!Number.isFinite(age) || age < 0) return "Confirm with the shelter";
  if (age < 48 * 60 * 60 * 1000) return "Recently seen in source feed";
  return "Older feed observation - confirm availability";
}
