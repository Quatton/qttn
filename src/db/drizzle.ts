import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { DefaultLogger, NoopLogger } from "drizzle-orm";

const libsql = createClient({
  url: import.meta.env.TURSO_DATABASE_URL,
  authToken: import.meta.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(libsql, {
  schema,
  logger: import.meta.env.DEV ? new DefaultLogger() : new NoopLogger(),
});
