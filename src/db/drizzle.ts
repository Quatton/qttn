import { createClient } from "@libsql/client";
import { DefaultLogger, NoopLogger } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const libsql = createClient({
  url: import.meta.env.TURSO_DATABASE_URL,
  authToken: import.meta.env.TURSO_AUTH_TOKEN
});

export const db = drizzle(libsql, {
  schema,
  logger: import.meta.env.DEV ? new DefaultLogger() : new NoopLogger()
});
