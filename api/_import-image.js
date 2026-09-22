import { safeImageUrl } from "./_safe-url.js";

// Do not turn an absent photo into a placeholder or import a non-web URL.
// This validates feed metadata, not the future availability of the remote file.
export function importImageUrl(value) {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (/\s/.test(clean)) return null;
  const image = safeImageUrl(clean);
  if (!image) return null;
  const url = new URL(image);
  return url.protocol === "https:" && url.hostname && !url.username && !url.password
    ? image : null;
}
