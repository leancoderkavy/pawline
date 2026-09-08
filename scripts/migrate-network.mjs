import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
const schema = await readFile(
  new URL("../db/network-growth.sql", import.meta.url),
  "utf8",
);
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL);
// DDL runs atomically under a transaction-scoped advisory lock. A failure rolls
// back the complete additive migration; reruns are safe.
await sql.transaction([
  sql`SELECT pg_advisory_xact_lock(7240919)`,
  ...schema
    .replace(/--[^\n]*/g, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => sql.query(s)),
]);
console.log("Network growth migration committed.");
