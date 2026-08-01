export function restoreFavoriteAfterFailure(current, listingId, attemptedFavorite) {
  const items = Array.isArray(current) ? current : [];
  return attemptedFavorite
    ? items.filter((item) => item !== listingId)
    : [...new Set([...items, listingId])];
}
