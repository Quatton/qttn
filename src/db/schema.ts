import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { InferSelectModel } from "drizzle-orm";

const now = sql`(unixepoch())`;
export const Words = sqliteTable("words", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").unique().notNull(),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(now),
  sampled_count: integer("sampled_count").notNull().default(0),
  rejected_count: integer("rejected_count").notNull().default(0),
  success_count: integer("success_count").notNull().default(0),
  likely_not_a_word_count: integer("likely_not_a_word_count")
    .notNull()
    .default(0),
  rejected_rate: real("rejected_rate").notNull().default(0),
  success_rate: real("success_rate").notNull().default(0),
  is_phrase: integer("is_phrase", { mode: "boolean" }).notNull().default(false),
});

export type Word = InferSelectModel<typeof Words>;
