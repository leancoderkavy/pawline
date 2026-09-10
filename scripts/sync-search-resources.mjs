import { readFile, writeFile } from 'node:fs/promises';
import { searchResources, SEARCH_ORIGIN } from '../src/resources/searchCatalog.js';

const start = '<!-- canonical-guides:start -->';
const end = '<!-- canonical-guides:end -->';
const block = `${start}\n${searchResources.map(resource => `- [${resource.title}](${SEARCH_ORIGIN}${resource.path}): ${resource.description}`).join('\n')}\n${end}`;
for (const name of ['llms.txt', 'llms-full.txt']) {
  const file = new URL(`../public/${name}`, import.meta.url);
  const source = await readFile(file, 'utf8');
  if (source.split(start).length !== 2 || source.split(end).length !== 2 || source.indexOf(end) < source.indexOf(start)) throw new Error(`Invalid guide markers: ${name}`);
  const updated = source.slice(0, source.indexOf(start)) + block + source.slice(source.indexOf(end) + end.length);
  if (process.argv.includes('--check')) {
    if (source !== updated) throw new Error(`${name} guide links are stale; run node scripts/sync-search-resources.mjs`);
  } else await writeFile(file, updated);
}
