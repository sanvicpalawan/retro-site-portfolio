import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

/**
 * Neon (and most hosted Postgres providers) require TLS. Local development
 * databases usually do not support it, so enable TLS only for remote hosts.
 */
function requiresTls(connectionString: string) {
  try {
    const { hostname, searchParams } = new URL(connectionString);
    const sslMode = searchParams.get("sslmode");
    if (sslMode === "disable") return false;
    if (sslMode && sslMode !== "prefer") return true;
    return !["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(hostname);
  } catch {
    return false;
  }
}

const globalForDb = globalThis as typeof globalThis & {
  __retroSitePortfolioPool?: Pool;
};

export const pool =
  globalForDb.__retroSitePortfolioPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl: requiresTls(databaseUrl) ? { rejectUnauthorized: true } : undefined,
    // Keep the pool small so serverless/edge-style deployments do not exhaust
    // the connection limit on a Neon branch.
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__retroSitePortfolioPool = pool;
}

export const db = drizzle(pool);
