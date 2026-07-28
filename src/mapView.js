export function hasMapCoordinates(item) {
  return Number.isFinite(item?.longitude) && Number.isFinite(item?.latitude);
}

export function distanceInMiles(item, center) {
  if (!center || !hasMapCoordinates(item)) return null;
  const radians = value => value * Math.PI / 180;
  const deltaLat = radians(item.latitude - center.latitude);
  const deltaLng = radians(item.longitude - center.longitude);
  const value = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(center.latitude)) * Math.cos(radians(item.latitude)) *
    Math.sin(deltaLng / 2) ** 2;
  return 3959 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function nearestFirst(items, center) {
  return [...items].sort((left, right) =>
    distanceInMiles(left, center) - distanceInMiles(right, center));
}

export function buildMapView({
  pets,
  events,
  discoveries,
  center,
  petType = "All",
  distance = 150,
  showEvents = true,
}) {
  const withinRange = item => {
    const miles = distanceInMiles(item, center);
    return miles !== null && miles <= Number(distance);
  };
  const speciesMatches = item =>
    petType === "All" || !item.species || item.species === petType;

  return {
    pets: nearestFirst(
      pets.filter(pet => speciesMatches(pet) && withinRange(pet)),
      center,
    ),
    events: showEvents
      ? nearestFirst(events.filter(withinRange), center)
      : [],
    discoveries: nearestFirst(
      discoveries.filter(item => speciesMatches(item) && withinRange(item)),
      center,
    ),
  };
}
