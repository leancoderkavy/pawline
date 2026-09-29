// Public provider links are untrusted. These sources failed the 2026-09-29
// production audit: unrelated/placeholder content, site-down redirects, or
// a non-working destination. Exact-path entries allow repaired routes later.
const BLOCKED_HOSTS = new Set([
  "collierpets.com", "basv.org", "unitedhope4animals.org",
  "ruffstartrescue.rescuegroups.org",
]);

const BLOCKED_URLS = new Set([
  "http://www.sbcphd.org/as",
  "http://www.co.adams.co.us/index.cfm?d=standard&b=1&c=15&s=61&p=115",
  "http://www.sfgov2.org/index.aspx?page=943",
  "http://www.cityofcasperwy.com/services/animal.html",
  "http://san-clemente.org/sc/standard.aspx?pageid=194",
  "http://www.seminolecountyfl.gov/dps/ansrvs/index.aspx",
  "http://www.co.weber.ut.us/animalshelter/",
  "http://www.peoriacounty.org/pcaps/",
  "http://defensaanimaldepuertorico.org/adopt-3/",
  "http://www.sbcityanimals.org/",
  "http://coronaanimalshelter.adoptapet.com/",
  "http://www.ddfl.org/adoption",
  "http://www.saccountyshelter.net/",
  "http://www.wpahumane.org/",
  "http://www.talgov.com/animals/kennel/index.cfm",
  "http://buttecounty.net/publichealth/animal/animal.html",
  "http://www.co.pg.md.us/Government/AgencyIndex/DER/AMD",
  "http://www.humanesocietyvc.com/",
  "http://www.co.missoula.mt.us/animcontrol",
  "http://www.co.humboldt.ca.us/sheriff/operations/default.asp?url=animalcontrol.htm",
]);

export function safePetSourceUrl(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    if (BLOCKED_HOSTS.has(url.hostname.toLowerCase().replace(/^www\./, ""))) return null;
    if (BLOCKED_URLS.has(url.href)) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function petSourceLinkLabel(sourceUrl, externalId) {
  const safeUrl = safePetSourceUrl(sourceUrl);
  if (!safeUrl) return "Source link unavailable";
  const url = new URL(safeUrl);
  const id = String(externalId || "").trim().toLowerCase();
  if (id.length >= 4) {
    const animalId = url.searchParams.get("AnimalID")?.toLowerCase();
    const petPathId = url.pathname.match(/^\/pet\/([^/]+)\/?$/i)?.[1]?.toLowerCase();
    const petHarborId = url.pathname.toLowerCase() === "/pet.asp"
      ? url.searchParams.get("uaid")?.toLowerCase().split(".").at(-1) : null;
    if (animalId === id || petPathId === id || petHarborId === id) return "Open pet listing";
  }
  return "Visit organization website";
}
