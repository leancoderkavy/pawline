import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
const schema = await readFile(new URL('../db/migrations/20260908-shelter-cache.sql',import.meta.url),'utf8');
if (process.argv.includes('--dry-run')) {
  console.log('Shelter cache migration: one additive table; no database connection used.');
} else {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const sql=neon(process.env.DATABASE_URL);
  const [before] = await sql`SELECT count(*)::int AS pets FROM pets`;
  await sql.transaction([sql`SELECT pg_advisory_xact_lock(7240919)`,sql.query(schema)]);
  const [after] = await sql`SELECT count(*)::int AS pets FROM pets`;
  console.log(JSON.stringify({migration:'shelter-cache',applied:true,petCountBefore:before.pets,petCountAfter:after.pets}));
}
