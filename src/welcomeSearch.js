// The welcome screen's "Find pets near" field. The map's own location search is hidden while the
// welcome panel is open, so this is the adopter's first chance to name a place.
export const WELCOME_QUERY_MAX = 120;

/** A place query ready for geocoding, or "" when nothing usable was typed. */
export function welcomeLocationQuery(raw) {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, WELCOME_QUERY_MAX);
}
