import { relations, sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import type { InferSelectModel } from "drizzle-orm";
import { alphabet, generateRandomString } from "oslo/crypto";

export const now = sql`(unixepoch())`;
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
  inappropriate_count: integer("inappropriate_count").notNull().default(0),
  rejected_rate: real("rejected_rate").notNull().default(0),
  success_rate: real("success_rate").notNull().default(0),
  is_phrase: integer("is_phrase", { mode: "boolean" }).notNull().default(false),
});

export const generateRandomId = () =>
  generateRandomString(5, alphabet("a-z", "0-9", "A-Z"));

export const gameModes = ["easy", "hard"] as const;
export type GameMode = (typeof gameModes)[number];
export const Games = sqliteTable("games", {
  id: text("id").primaryKey().$defaultFn(generateRandomId),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(now),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(now),
  content: text("content").notNull().default(""),
  state: text("state", {
    mode: "text",
    enum: ["in_progress", "abandoned", "completed"],
  })
    .notNull()
    .default("in_progress"),
  mode: text("mode", {
    mode: "text",
    enum: gameModes,
  })
    .notNull()
    .default("easy"),
});

export const GameWords = sqliteTable(
  "game_words",
  {
    game_id: text("game_id")
      .references(() => Games.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    word_id: integer("word_id")
      .references(() => Words.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    index: integer("index").notNull(),
    created_at: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(now),
    updated_at: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(now),
    matched: integer("matched", { mode: "boolean" }).notNull().default(false),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.word_id, table.game_id] }),
  }),
);

export const gameWordRelations = relations(GameWords, ({ one }) => ({
  word: one(Words, {
    fields: [GameWords.word_id],
    references: [Words.id],
  }),
  game: one(Games, {
    fields: [GameWords.game_id],
    references: [Games.id],
  }),
}));

export const gameRelations = relations(Games, ({ many }) => ({
  gameToWords: many(GameWords),
}));

export const wordRelations = relations(Words, ({ many }) => ({
  wordToGames: many(GameWords),
}));

export type Game = InferSelectModel<typeof Games>;
export type Word = InferSelectModel<typeof Words>;
