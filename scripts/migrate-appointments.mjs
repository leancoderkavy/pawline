import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
const sql = await readFile(new URL('../db/migrations/20260908-appointments.sql', import.meta.url), 'utf8');
const statements = sql.split(';').map(value => value.trim()).filter(Boolean);
if (process.argv.includes('--dry-run')) {
  if (statements.length !== 10 || !statements.every(value => /^CREATE (TABLE|INDEX|UNIQUE INDEX) IF NOT EXISTS /.test(value))) throw new Error('Unexpected appointment migration');
  console.log(`Appointment migration checked: ${statements.length} additive statements.`);
} else {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL for the verified target before running this migration.');
  const db = neon(process.env.DATABASE_URL);
  const result = await db.transaction([
    db`SELECT count(*)::int AS pets FROM pets`,
    ...statements.map(statement => db.query(statement)),
    db`SELECT count(*)::int AS pets FROM pets`,
    db`SELECT to_regclass('public.adoption_appointments') AS appointments, to_regclass('public.appointment_video_reservations') AS reservations`,
  ]);
  if (result[0][0].pets !== result.at(-2)[0].pets || !result.at(-1)[0].appointments || !result.at(-1)[0].reservations) throw new Error('Appointment migration verification failed');
  console.log(JSON.stringify({ applied: true, statements: statements.length, petsPreserved: result[0][0].pets }));
}
