import { createClient } from "@libsql/client";
import { getSecret } from "astro:env/server";
import { DefaultLogger, NoopLogger } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

function createLibsqlClient() {
  return createClient({
    url: getSecret("TURSO_DATABASE_URL")!,
    authToken: getSecret("TURSO_AUTH_TOKEN")!,
  });
}

let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!db) {
    const client = createLibsqlClient();
    const logger = import.meta.env.DEV ? new DefaultLogger() : new NoopLogger();
    db = drizzle(client, { schema, logger });
  }
  return db;
}
