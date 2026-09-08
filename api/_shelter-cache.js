export const SHELTER_CACHE_FRESH_MS = 15 * 60 * 1000;
export const SHELTER_CACHE_STALE_MS = 7 * 86400000;

export async function readShelterCache(database, key) {
  if (!database) return null;
  const [row] =
    await database`SELECT payload,observed_at,retry_at FROM shelter_search_cache WHERE cache_key=${key}`;
  if (!row) return null;
  return {
    value: row.payload,
    observedAt: row.observed_at ? new Date(row.observed_at).getTime() : 0,
    retryAt: new Date(row.retry_at).getTime(),
  };
}

export async function claimShelterRefresh(database, key, now) {
  if (!database) return true;
  const rows =
    await database`INSERT INTO shelter_search_cache (cache_key,retry_at) VALUES (${key},${new Date(now + 30000).toISOString()})
    ON CONFLICT (cache_key) DO UPDATE SET retry_at=EXCLUDED.retry_at WHERE shelter_search_cache.retry_at <= ${new Date(now).toISOString()}::timestamptz RETURNING cache_key`;
  return rows.length > 0;
}

export async function writeShelterCache(
  database,
  key,
  value,
  now,
  retryMs = SHELTER_CACHE_FRESH_MS,
) {
  if (!database) return;
  await database`INSERT INTO shelter_search_cache (cache_key,payload,observed_at,retry_at)
    VALUES (${key},${value ? JSON.stringify(value) : null}::jsonb,${value ? new Date(now).toISOString() : null}::timestamptz,${new Date(now + retryMs).toISOString()})
    ON CONFLICT (cache_key) DO UPDATE SET payload=COALESCE(EXCLUDED.payload,shelter_search_cache.payload),observed_at=COALESCE(EXCLUDED.observed_at,shelter_search_cache.observed_at),retry_at=EXCLUDED.retry_at`;
  // This table contains only disposable public search results, never accounts.
  await database`DELETE FROM shelter_search_cache WHERE cache_key IN (SELECT cache_key FROM shelter_search_cache ORDER BY COALESCE(observed_at,retry_at) DESC OFFSET 1000)`;
}
