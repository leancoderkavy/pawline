export function petSourceLinkLabel(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    if (url.pathname === "/" && !url.search && !url.hash) return "Visit organization website";
  } catch {
    // Source URLs are validated before rendering; keep the label truthful if one slips through.
  }
  return "Open source page";
}
