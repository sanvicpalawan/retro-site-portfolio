import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Reads DATABASE_URL from `.env`, so `npx drizzle-kit push` targets whichever
// database you point at: the local one, or your Neon branch.
const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
