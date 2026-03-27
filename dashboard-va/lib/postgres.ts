import "server-only";
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __dashboardVaPool: Pool | undefined;
}

export function getPostgres() {
  if (global.__dashboardVaPool) {
    return global.__dashboardVaPool;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local before using initiative persistence.");
  }

  const pool = new Pool({ connectionString });

  if (process.env.NODE_ENV !== "production") {
    global.__dashboardVaPool = pool;
  }

  return pool;
}
