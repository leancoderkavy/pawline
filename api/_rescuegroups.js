export function buildRescueGroupsUrl(apiBase, pathname, query = {}) {
  const normalizedBase = `${String(apiBase).replace(/\/+$/, "")}/`;
  const url = new URL(String(pathname).replace(/^\/+/, ""), normalizedBase);

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}
