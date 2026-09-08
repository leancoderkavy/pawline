// Public facility addresses checked against the official directory on 2026-09-08.
// Coordinates retain the existing shelter-level map positions, not animal locations.
export const LOS_ANGELES_CENTERS = {
  LACT: {
    name: "East Valley Animal Shelter",
    address: "14409 Vanowen St, Van Nuys, CA 91405",
    city: "Van Nuys, California, United States",
    latitude: 34.193986435685,
    longitude: -118.446771390738,
  },
  LACT2: {
    name: "West Los Angeles Animal Shelter",
    address: "11361 West Pico Blvd, Los Angeles, CA 90064",
    city: "Los Angeles, California, United States",
    latitude: 34.034628815564,
    longitude: -118.439972412714,
  },
  LACT3: {
    name: "Chesterfield Square / South LA Animal Shelter",
    address: "1850 W 60th St, Los Angeles, CA 90047",
    city: "Los Angeles, California, United States",
    latitude: 33.98517085948,
    longitude: -118.310507744437,
  },
  LACT4: {
    name: "North Central Animal Shelter",
    address: "3201 Lacy St, Los Angeles, CA 90031",
    city: "Los Angeles, California, United States",
    latitude: 34.083720752489,
    longitude: -118.218016326391,
  },
  LACT5: {
    name: "West Valley Animal Shelter",
    address: "20655 Plummer St, Chatsworth, CA 91311",
    city: "Chatsworth, California, United States",
    latitude: 34.242784438194,
    longitude: -118.583183249589,
  },
};

export const PUBLIC_SHELTERS = Object.entries(LOS_ANGELES_CENTERS).map(
  ([code, center]) => ({
    ...center,
    id: `directory-${code}`,
    operator: "LA Animal Services",
    website: "https://www.laanimalservices.com/give-us-feedback",
    sourceUrl: "https://www.laanimalservices.com/give-us-feedback",
    source: "Official shelter directory",
    reviewedAt: "2026-09-08",
    adoptionIndicated: false,
    openingHours: null,
    animals: null,
  }),
);
