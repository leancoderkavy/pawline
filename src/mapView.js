export function hasMapCoordinates(item) {
  return Number.isFinite(item?.longitude) && Math.abs(item.longitude) <= 180 &&
    Number.isFinite(item?.latitude) && Math.abs(item.latitude) <= 90;
}

export function mapResultBounds(points) {
  const valid = points.filter(hasMapCoordinates);
  if (!valid.length) return null;
  return valid.reduce((bounds, point) => [
    [Math.min(bounds[0][0], point.longitude), Math.min(bounds[0][1], point.latitude)],
    [Math.max(bounds[1][0], point.longitude), Math.max(bounds[1][1], point.latitude)],
  ], [[valid[0].longitude, valid[0].latitude], [valid[0].longitude, valid[0].latitude]]);
}

export function petResultDetail(item) {
  const breed = item?.breed && !/^(unknown|see official listing|details available from)/i.test(item.breed) ? item.breed : null;
  return [item?.species, breed || item?.city || "Open details"]
    .filter(Boolean)
    .join(" · ");
}

export function petCountLabel(count, petType = "All") {
  const normalizedCount = Number(count) || 0;
  const singular = petType === "Cat" ? "cat" : petType === "Dog" ? "dog" : "pet";
  return `${normalizedCount} ${singular}${normalizedCount === 1 ? "" : "s"}`;
}

export function distanceInMiles(item, center) {
  if (!hasMapCoordinates(center) || !hasMapCoordinates(item)) return null;
  const radians = value => value * Math.PI / 180;
  const deltaLat = radians(item.latitude - center.latitude);
  const deltaLng = radians(item.longitude - center.longitude);
  const value = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(center.latitude)) * Math.cos(radians(item.latitude)) *
    Math.sin(deltaLng / 2) ** 2;
  const clamped = Math.max(0, Math.min(1, value));
  return 3959 * 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));
}

function nearestFirst(items, center, radius) {
  return items.map(item => ({ item, miles: distanceInMiles(item, center) }))
    .filter(({ miles }) => miles !== null && miles <= Number(radius))
    .sort((left, right) => left.miles - right.miles)
    .map(({ item }) => item);
}

export function buildMapView({
  pets,
  events,
  discoveries,
  shelters = [],
  center,
  petType = "All",
  distance = 150,
  showEvents = true,
}) {
  const speciesMatches = item =>
    petType === "All" || !item.species || item.species === petType;

  return {
    pets: nearestFirst(
      pets.filter(speciesMatches),
      center, distance,
    ),
    events: showEvents
      ? nearestFirst(events, center, distance)
      : [],
    discoveries: nearestFirst(
      discoveries.filter(speciesMatches),
      center, distance,
    ),
    shelters: nearestFirst(shelters, center, distance),
  };
}
