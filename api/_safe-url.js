export function safeHttpUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

// Listing photos must be https: the production CSP allows only `https:` in
// img-src, so an upstream http: photo is blocked and renders as a broken card.
export function safeImageUrl(value) {
  if (typeof value !== "string") return null;
  return safeHttpUrl(value.replace(/^http:/i, "https:"));
}
