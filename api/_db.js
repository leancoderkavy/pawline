import { neon } from "@neondatabase/serverless";

let sql;

export function getDatabase() {
  // Allow tests to inject a mock database
  if (globalThis.__TEST_MOCK_DATABASE__) {
    return globalThis.__TEST_MOCK_DATABASE__;
  }
  
  if (!process.env.DATABASE_URL) return null;
  if (!sql) sql = neon(process.env.DATABASE_URL);
  return sql;
}
