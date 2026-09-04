// Share only unfinished public-provider work within this server instance.
// Settled results (including errors) are never cached.
export function createPublicFeedCoalescer({ maxEntries = 128 } = {}) {
  const pending = new Map();
  return function coalesce(key, load) {
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= maxEntries) return Promise.resolve().then(load);
    const promise = Promise.resolve().then(load).finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  };
}

export async function readBoundedText(response, maxBytes = 15 * 1024 * 1024) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Provider returned an empty response body");
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("Provider response exceeds size limit");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size).toString("utf8");
}

export function deduplicatePets(pets) {
  const ids = new Set();
  const externalIds = new Set();
  return pets.filter((pet) => {
    const duplicate = ids.has(pet.id) || (pet.externalId && externalIds.has(pet.externalId));
    // Track rejected rows too, preserving the original first-occurrence rules.
    ids.add(pet.id);
    if (pet.externalId) externalIds.add(pet.externalId);
    return !duplicate;
  });
}
