import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

if (process.env.PROD) dotenv.config({ path: ".env.production" });
else dotenv.config({ path: ".env.local" });

if (
  !process.env.TURSO_DATABASE_URL ||
  (process.env.PROD && !process.env.TURSO_AUTH_TOKEN)
) {
  console.error(
    "Please set NUXT_TURSO_DATABASE_URL and NUXT_TURSO_AUTH_TOKEN in your environment",
  );
  process.exit(1);
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  dialect: "sqlite",
  out: "./drizzle",
  driver: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
