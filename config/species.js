export const PET_SPECIES = [
  "Dog",
  "Cat",
  "Rabbit",
  "Bird",
  "Small animal",
  "Horse",
  "Reptile",
  "Barnyard",
];
export function canonicalPetSpecies(value) {
  const name = String(value || "")
    .trim()
    .toLowerCase();
  return (
    PET_SPECIES.find((item) => item.toLowerCase() === name) ||
    {
      canine: "Dog",
      feline: "Cat",
      bunny: "Rabbit",
      avian: "Bird",
      equine: "Horse",
      "small & furry": "Small animal",
      "guinea pig": "Small animal",
      hamster: "Small animal",
      ferret: "Small animal",
      rat: "Small animal",
      mouse: "Small animal",
      gerbil: "Small animal",
      chinchilla: "Small animal",
      turtle: "Reptile",
      tortoise: "Reptile",
      gecko: "Reptile",
      iguana: "Reptile",
      snake: "Reptile",
      lizard: "Reptile",
      goat: "Barnyard",
      pig: "Barnyard",
      sheep: "Barnyard",
      cow: "Barnyard",
    }[name] ||
    null
  );
}
