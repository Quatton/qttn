import { keys } from "@/lib/const/rules";
import {
  ActionError,
  defineAction,
  type ActionAPIContext,
} from "astro:actions";
import { z } from "astro/zod";
import { db } from "@/db/drizzle";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  gameModes,
  Games,
  GameWords,
  now,
  Words,
  type GameMode,
} from "@/db/schema";
import type { Definition } from "@/lib/const/dictionary";
import { TimeSpan } from "oslo";

async function generateWords(limit: number, mode: GameMode = "easy") {
  const sq = db.$with("sq").as(
    db
      .select()
      .from(Words)
      .orderBy(asc(sql`RANDOM()`))
      .where(
        and(
          eq(Words.likely_not_a_word_count, 0),
          eq(Words.inappropriate_count, 0),
          ...(mode === "easy" ? [gte(Words.sampled_count, 100)] : []),
        ),
      )
      .limit(limit * 5),
  );

  const words = await db
    .with(sq)
    .select({
      id: sq.id,
      name: sq.name,
    })
    .from(sq)
    .orderBy(asc(sq.rejected_rate));

  const eighty = Math.floor(mode === "easy" ? limit * 0.8 : limit * 0.2);
  const twenty = limit - eighty;

  const _t = [...words.slice(0, eighty), ...words.slice(words.length - twenty)];

  const t = _t.map((word) => ({
    id: word.id,
    name: word.name,
  }));

  await db
    .update(Words)
    .set({
      sampled_count: sql`${Words.sampled_count} + 1`,
      rejected_rate: sql`CAST (${Words.rejected_count} as REAL) / (${Words.sampled_count} + 1)`,
      success_rate: sql`CAST (${Words.success_count} as REAL) / (${Words.sampled_count} + 1)`,
    })
    .where(
      inArray(
        Words.id,
        t.map((word) => word.id),
      ),
    );

  return t;
}

async function defineWord(word: string) {
  const url = "https://api.dictionaryapi.dev/api/v2/entries/en/";

  const urlWithParam = new URL(encodeURIComponent(word), url);

  const response = await fetch(urlWithParam.toString());

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as Definition[];

  return data;
}

const ratelimiter =
  (duration: TimeSpan, number: number, cookieKey = "const:ratelimited") =>
  (ctx: ActionAPIContext) => {
    const cookie = ctx.cookies.get(cookieKey)?.number();
    const cookieOption = {
      expires: new Date(Date.now() + duration.milliseconds()),
      domain: `.${ctx.url.hostname}`,
      secure: import.meta.env.PROD,
      path: "/",
    };
    if (cookie) {
      ctx.cookies.set(cookieKey, (cookie + 1).toString(), cookieOption);
      if (cookie >= number) {
        throw new ActionError({
          code: "TOO_MANY_REQUESTS",
          message: "Rate limited",
        });
      }
    } else {
      ctx.cookies.set(cookieKey, "1", cookieOption);
    }
  };

const fivePerFiveSeconds = ratelimiter(new TimeSpan(5, "s"), 5);
const fiveSecond = ratelimiter(new TimeSpan(5, "s"), 1);

export const game = {
  updateGame: defineAction({
    input: z.object({
      id: z.string(),
      content: z.string().optional(),
      mode: z.enum(gameModes).optional(),
    }),
    handler: async (input, ctx) => {
      const id = input.id;

      const [game] = await db
        .update(Games)
        .set({
          content: input.content,
          mode: input.mode,
          updated_at: now,
        })
        .where(eq(Games.id, id))
        .returning({
          id: Games.id,
          content: Games.content,
          mode: Games.mode,
          updated_at: Games.updated_at,
        });
      return game;
    },
  }),
  new: defineAction({
    input: z
      .object({
        rules: z.array(z.enum(keys)).default(["useGivenWords"]),
        maxWords: z.number().int().positive().default(10),
        mode: z.enum(gameModes).default("easy"),
      })
      .default({
        rules: ["useGivenWords"],
        maxWords: 10,
      }),
    handler: async (input, ctx) => {
      const [{ id }] = await db
        .insert(Games)
        .values({
          mode: input.mode,
        })
        .returning({
          id: Games.id,
        });

      const words = await generateWords(input.maxWords, input.mode);

      await db
        .insert(GameWords)
        .values(
          words.map((word, index) => ({
            game_id: id,
            word_id: word.id,
            index,
          })),
        )
        .catch((e) => {
          console.error(e);
          throw new ActionError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to insert words",
          });
        });

      ctx.cookies.set(
        "const:session",
        JSON.stringify({
          id,
        }),
        {
          expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
          path: "/",
          domain: `.${ctx.url.hostname}`,
          secure: import.meta.env.PROD,
        },
      );

      return id;
    },
  }),
  words: defineAction({
    input: z.object({
      gameId: z.string(),
      mode: z.enum(gameModes).optional(),
      max: z.number().int().positive().default(10),
    }),
    handler: async (input, ctx) => {
      const id = input.gameId;

      const mode =
        input.mode ??
        (await db
          .select({ mode: Games.mode })
          .from(Games)
          .where(eq(Games.id, id))
          .then((res) => res[0].mode));

      const words = await generateWords(input.max, mode);

      await db
        .delete(GameWords)
        .where(eq(GameWords.game_id, id))
        .catch((_) => {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Game not found",
          });
        });

      await db
        .insert(GameWords)
        .values(
          words.map((word, index) => ({
            game_id: id,
            word_id: word.id,
            index,
          })),
        )
        .catch((_) => {
          throw new ActionError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to insert words",
          });
        });

      return words;
    },
  }),
  swapOut: defineAction({
    input: z.object({
      gameId: z.string(),
      mode: z.enum(gameModes).optional(),
      wordId: z.number().int(),
      reason: z.enum(["difficult", "notAWord", "inappropriate"]),
    }),
    handler: async (input, ctx) => {
      const id = input.gameId;
      const mode =
        input.mode ??
        (await db
          .select({ mode: Games.mode })
          .from(Games)
          .where(eq(Games.id, id))
          .then((res) => res[0].mode));

      const index = await db
        .transaction(async (db) => {
          const [{ index }] = await db
            .delete(GameWords)
            .where(
              and(
                eq(GameWords.game_id, id),
                eq(GameWords.word_id, input.wordId),
              ),
            )
            .returning({
              index: GameWords.index,
            })
            .catch((_) => {
              throw new ActionError({
                code: "NOT_FOUND",
                message: "Word not found",
              });
            });

          await db
            .update(Words)
            .set({
              rejected_count: sql`${Words.rejected_count} + 1`,
              rejected_rate: sql`CAST (${Words.rejected_count} as REAL) / ${Words.sampled_count}`,
              likely_not_a_word_count:
                input.reason === "notAWord"
                  ? sql`${Words.likely_not_a_word_count} + 1`
                  : undefined,
              inappropriate_count:
                input.reason === "inappropriate"
                  ? sql`${Words.inappropriate_count} + 1`
                  : undefined,
            })
            .where(eq(Words.id, input.wordId))
            .catch((e) => {
              db.rollback();
              throw new ActionError({
                code: "NOT_FOUND",
                message: "Word not found",
              });
            });

          return index;
        })
        .catch((e) => {
          throw e;
        });

      const [newWord] = await generateWords(1, mode);

      await db
        .insert(GameWords)
        .values({
          game_id: id,
          word_id: newWord.id,
          index,
        })
        .catch((e) => {
          throw new ActionError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to insert word",
          });
        });

      return newWord;
    },
  }),
  dictionary: defineAction({
    input: z.object({
      word: z.string(),
    }),
    handler: (input, ctx) => {
      return defineWord(input.word);
    },
  }),
};
