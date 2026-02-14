import { db } from "@/db/drizzle";
import { gameModes, Games, GameWords, now, Words, WordShortList, type GameMode } from "@/db/schema";
import type { Definition } from "@/lib/const/dictionary";
import { keys } from "@/lib/const/rules";
import { z } from "astro/zod";
import { ActionError, defineAction } from "astro:actions";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";

async function generateWords(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  limit: number,
  mode: GameMode = "easy",
) {
  const sq = tx.$with("sq").as(
    tx
      .select()
      .from(WordShortList)
      .orderBy(asc(sql`random()`))
      .where(
        and(
          eq(Words.likely_not_a_word_count, 0),
          eq(Words.inappropriate_count, 0),
          ...(mode === "easy" ? [gte(Words.sampled_count, 100)] : []),
        ),
      )
      .innerJoin(Words, eq(WordShortList.id, Words.id))
      .limit(limit),
  );

  const words = await tx
    .with(sq)
    .select({
      id: sq.words.id,
      name: sq.words.name,
    })
    .from(sq)
    .orderBy(asc(sq.words.rejected_rate));

  const eighty = Math.floor(mode === "easy" ? limit * 0.8 : limit * 0.2);
  const twenty = limit - eighty;

  const _t = [...words.slice(0, eighty), ...words.slice(words.length - twenty)];

  const t = _t.map((word) => ({
    id: word.id,
    name: word.name,
  }));

  await tx
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

export const game = {
  updateGame: defineAction({
    input: z.object({
      id: z.string(),
      content: z.string().optional(),
      mode: z.enum(gameModes).optional(),
    }),
    handler: async (input, _ctx) => {
      const id = input.id;

      return await db.transaction(async (tx) => {
        const [game] = await tx
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
      });
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
      const id = await db.transaction(async (tx) => {
        const [{ id }] = await tx
          .insert(Games)
          .values({
            mode: input.mode,
          })
          .returning({
            id: Games.id,
          });

        const words = await generateWords(tx, input.maxWords, input.mode);

        await tx.insert(GameWords).values(
          words.map((word, index) => ({
            game_id: id,
            word_id: word.id,
            index,
          })),
        );

        return id;
      });

      ctx.cookies.set(
        "const-session",
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
    handler: async (input, _ctx) => {
      const id = input.gameId;

      return await db.transaction(async (tx) => {
        const mode =
          input.mode ??
          (await tx
            .select({ mode: Games.mode })
            .from(Games)
            .where(eq(Games.id, id))
            .then((res) => res[0].mode));

        const words = await generateWords(tx, input.max, mode);

        await tx.delete(GameWords).where(eq(GameWords.game_id, id));

        await tx.insert(GameWords).values(
          words.map((word, index) => ({
            game_id: id,
            word_id: word.id,
            index,
          })),
        );

        return words;
      });
    },
  }),
  swapOut: defineAction({
    input: z.object({
      gameId: z.string(),
      mode: z.enum(gameModes).optional(),
      wordId: z.number().int(),
      reason: z.enum(["difficult", "notAWord", "inappropriate"]),
    }),
    handler: async (input, _ctx) => {
      const id = input.gameId;

      return await db.transaction(async (tx) => {
        const mode =
          input.mode ??
          (await tx
            .select({ mode: Games.mode })
            .from(Games)
            .where(eq(Games.id, id))
            .then((res) => res[0].mode));

        const [{ index }] = await tx
          .delete(GameWords)
          .where(and(eq(GameWords.game_id, id), eq(GameWords.word_id, input.wordId)))
          .returning({
            index: GameWords.index,
          })
          .catch(() => {
            throw new ActionError({
              code: "NOT_FOUND",
              message: "Word not found",
            });
          });

        await tx
          .update(Words)
          .set({
            rejected_count: sql`${Words.rejected_count} + 1`,
            rejected_rate: sql`CAST ((${Words.rejected_count} + 1) as REAL) / ${Words.sampled_count}`,
            likely_not_a_word_count:
              input.reason === "notAWord" ? sql`${Words.likely_not_a_word_count} + 1` : undefined,
            inappropriate_count:
              input.reason === "inappropriate" ? sql`${Words.inappropriate_count} + 1` : undefined,
          })
          .where(eq(Words.id, input.wordId))
          .catch((e) => {
            console.error(e);
            throw new ActionError({
              code: "NOT_FOUND",
              message: "Word not found",
            });
          });

        const [newWord] = await generateWords(tx, 1, mode);

        await tx
          .insert(GameWords)
          .values({
            game_id: id,
            word_id: newWord.id,
            index,
          })
          .catch((e) => {
            console.error(e);
            throw new ActionError({
              code: "NOT_FOUND",
              message: "Cannot insert new word",
            });
          });

        return newWord;
      });
    },
  }),
  dictionary: defineAction({
    input: z.object({
      word: z.string(),
    }),
    handler: (input, _ctx) => {
      return defineWord(input.word);
    },
  }),
};
