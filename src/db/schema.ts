import { generateRandomString, type RandomReader } from "@oslojs/crypto/random";
import type { InferSelectModel } from "drizzle-orm";
import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex
} from "drizzle-orm/sqlite-core";

/** KEEP FOR LEGACY */

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
  is_phrase: integer("is_phrase", { mode: "boolean" }).notNull().default(false)
});

const random: RandomReader = {
  read(bytes) {
    crypto.getRandomValues(bytes);
  }
};

const ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export const generateRandomId = () => generateRandomString(random, ALPHABET, 5);

export const gameModes = ["easy", "hard"] as const;
export type GameMode = (typeof gameModes)[number];

export const WordShortList = sqliteTable("word_short_list", {
  id: integer("id")
    .references(() => Words.id, {
      onDelete: "cascade",
      onUpdate: "cascade"
    })
    .primaryKey()
    .notNull(),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(now)
});

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
    enum: ["in_progress", "abandoned", "completed"]
  })
    .notNull()
    .default("in_progress"),
  mode: text("mode", {
    mode: "text",
    enum: gameModes
  })
    .notNull()
    .default("easy")
});

export const GameWords = sqliteTable(
  "game_words",
  {
    game_id: text("game_id")
      .references(() => Games.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      })
      .notNull(),
    word_id: integer("word_id")
      .references(() => Words.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      })
      .notNull(),
    index: integer("index").notNull(),
    created_at: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(now),
    updated_at: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(now),
    matched: integer("matched", { mode: "boolean" }).notNull().default(false)
  },
  (table) => [
    primaryKey({ columns: [table.word_id, table.game_id] }),
    index("game_words_game_id_index").on(table.game_id, table.index)
  ]
);

export const gameWordRelations = relations(GameWords, ({ one }) => ({
  word: one(Words, {
    fields: [GameWords.word_id],
    references: [Words.id]
  }),
  game: one(Games, {
    fields: [GameWords.game_id],
    references: [Games.id]
  })
}));

export const gameRelations = relations(Games, ({ many }) => ({
  gameToWords: many(GameWords)
}));

export const wordRelations = relations(Words, ({ many }) => ({
  wordToGames: many(GameWords)
}));

export type Game = InferSelectModel<typeof Games>;
export type Word = InferSelectModel<typeof Words>;

/** END LEGACY */

export const storyViews = sqliteTable(
  "story_views",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    story_id: text("story_id").notNull(),
    ip_address: text("ip_address").notNull(),
    utm_source: text("utm_source").notNull().default("direct"),
    view_date: text("view_date").notNull(),
    created_at: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(now)
  },
  (table) => [
    index("story_views_story_id_index").on(table.story_id),
    index("story_views_created_at_index").on(table.created_at),
    index("story_views_utm_source_index").on(table.utm_source),
    uniqueIndex("story_views_daily_unique_ip_index").on(
      table.story_id,
      table.ip_address,
      table.utm_source,
      table.view_date
    )
  ]
);

export type StoryView = InferSelectModel<typeof storyViews>;
