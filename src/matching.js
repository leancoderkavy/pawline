export const ANY_LIFESTYLE = "Any lifestyle";

const normalize = (value) => String(value || "").trim().toLowerCase();

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
