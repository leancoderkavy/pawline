const DEFAULT_API_BASE = "https://www.pawlineadopt.com";
const REQUEST_TIMEOUT_MS = 20_000;

export function apiBase(value = process.env.PAWLINE_API_BASE) {
  const url = new URL(value || DEFAULT_API_BASE);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('PAWLINE_API_BASE must use http or https.');
  }
  return url;
}

export async function getJson(path, searchParams, fetchImpl = fetch) {
  const url = new URL(path, apiBase());
  for (const [key, value] of Object.entries(searchParams || {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'pawline-mcp/1.0.0',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Pawline returned HTTP ${response.status}.`);
  }
  return response.json();
}

export function compactPet(pet) {
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    age: pet.age,
    sex: pet.sex,
    size: pet.size,
    city: pet.city,
    shelter: pet.shelter,
    description: pet.description || null,
    source: pet.source,
    sourceUrl: pet.sourceUrl || null,
    image: pet.image || null,
  };
}

export function filterPets(pets, query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return pets;
  return pets.filter((pet) => [
    pet.name,
    pet.breed,
    pet.age,
    pet.sex,
    pet.size,
    pet.city,
    pet.shelter,
    pet.description,
  ].some((value) => String(value || '').toLowerCase().includes(needle)));
}
