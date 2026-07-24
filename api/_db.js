import { neon } from "@neondatabase/serverless";

let sql;

export function getDatabase() {
  if (!process.env.DATABASE_URL) return null;
  if (!sql) sql = neon(process.env.DATABASE_URL);
  return sql;
}
