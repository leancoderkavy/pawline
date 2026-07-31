import fs from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const schemaUrl = new URL("../db/schema.sql", import.meta.url);
const schema = await fs.readFile(schemaUrl, "utf8");
const sql = neon(process.env.DATABASE_URL);

await sql.query(schema);

const [verification] = await sql`
  SELECT
    to_regclass('public.pets') AS pets,
    to_regclass('public.pet_submission_files') AS submission_files,
    to_regclass('public.pet_submission_log') AS submission_log,
    to_regclass('public.user_favorites') AS user_favorites
`;

if (!verification?.pets || !verification?.submission_files || !verification?.submission_log || !verification?.user_favorites) {
  throw new Error("Database migration did not create every required table.");
}

console.log("Pawline database schema is current.");
