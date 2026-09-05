export function parseStoredFavorites(raw) {
  const parsed = JSON.parse(raw || "[]");
  if (!Array.isArray(parsed)) throw new Error("Invalid saved favorites");
  return [...new Set(parsed.filter(id =>
    (typeof id === "string" && id.trim().length > 0) ||
    (typeof id === "number" && Number.isFinite(id)),
  ))];
}

export function restoreFavoriteAfterFailure(current, listingId, attemptedFavorite) {
  const items = Array.isArray(current) ? current : [];
  return attemptedFavorite
    ? items.filter((item) => item !== listingId)
    : [...new Set([...items, listingId])];
}
