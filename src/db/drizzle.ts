import { createClient } from "@libsql/client";
import { getSecret } from "astro:env/server";
import { DefaultLogger, NoopLogger } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const libsql = createClient({
  url: getSecret("TURSO_DATABASE_URL")!,
  authToken: getSecret("TURSO_AUTH_TOKEN")!
});

export const db = drizzle(libsql, {
  schema,
  logger: import.meta.env.DEV ? new DefaultLogger() : new NoopLogger()
});
