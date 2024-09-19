import {
  keys,
  type GameSession,
  type WordAndDefinition,
} from "@/lib/const/rules";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { db } from "@/db/drizzle";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { Words, type Word } from "@/db/schema";
import type { Definition } from "@/lib/const/dictionary";

async function generateWords(limit: number) {
  const sq = db.$with("sq").as(
    db
      .select()
      .from(Words)
      .orderBy(asc(sql`RANDOM()`))
      .limit(limit * 5),
  );

  const words = await db
    .with(sq)
    .select()
    .from(sq)
    .orderBy(asc(sq.sampled_count), asc(sq.rejected_rate))
    .limit(limit);

  await db
    .update(Words)
    .set({
      sampled_count: sql`${Words.sampled_count} + 1`,
      rejected_rate: sql`${Words.rejected_count} / (${Words.sampled_count} + 1)`,
    })
    .where(
      inArray(
        Words.id,
        words.map((word) => word.id),
      ),
    );

  return words;
}

async function defineWord(word: string) {
  const url = "https://api.dictionaryapi.dev/api/v2/entries/en/";

  const urlWithParam = new URL(`${url}${word}`);

  const response = await fetch(urlWithParam.toString());

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as Definition[];

  return data[0];
}

export const game = {
  new: defineAction({
    input: z.object({
      rules: z.array(z.enum(keys)),
      maxWords: z.number().int().positive().default(10),
    }),
    handler: async (input, ctx) => {
      const words = await generateWords(input.maxWords);
      const definitions = await Promise.all(
        words.map((word) => defineWord(word.name)),
      );
      const packed: WordAndDefinition[] = words.map((word, i) => ({
        word,
        definition: definitions[i],
      }));

      ctx.cookies.set(
        "const:session",
        JSON.stringify({ rules: input.rules, words: packed }),
      );
    },
  }),
  words: defineAction({
    input: z.object({
      max: z.number().int().positive().default(10),
    }),
    handler: async (input, ctx) => {
      const game: GameSession = ctx.cookies.get("const:session")?.json() ?? {
        rules: ["useGivenWords"],
        words: [],
      };

      if (game.words.length < input.max) {
        const newWords = await generateWords(input.max - game.words.length);
        const definitions = await Promise.all(
          newWords.map((word) => defineWord(word.name)),
        );
        game.words.push(
          ...newWords.map((word, i) => ({
            word,
            definition: definitions[i],
          })),
        );
      }

      ctx.cookies.set(
        "const:session",
        JSON.stringify({
          rules: game.rules,
          words: game.words.slice(0, input.max),
        }),
        {
          expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
          path: "/",
          domain: `.${ctx.url.hostname}`,
          secure: import.meta.env.PROD,
        },
      );

      return game.words;
    },
  }),
  swapOut: defineAction({
    input: z.object({
      wordId: z.number().int(),
    }),
    handler: async (input, ctx) => {
      const gameSession = ctx.cookies
        .get("const:session")
        ?.json() as GameSession;

      if (!gameSession) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Game not found",
        });
      }

      const { words } = gameSession;

      const word = words.find((w) => w.word.id === input.wordId);

      if (!word) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Word not found",
        });
      }

      await db
        .update(Words)
        .set({
          rejected_count: sql`${Words.rejected_count} + 1`,
          rejected_rate: sql`CASE WHEN ${Words.sampled_count} = 0 THEN 0 ELSE (${Words.rejected_count} + 1) / ${Words.sampled_count} END`,
        })
        .where(eq(Words.id, word.word.id));

      const [newWord] = await db
        .select()
        .from(Words)
        .orderBy(asc(sql`RANDOM()`))
        .limit(1);

      const newDefinition = await defineWord(newWord.name);

      const newWords = words.map((w) =>
        w.word.id === input.wordId
          ? {
              word: newWord,
              definition: newDefinition,
            }
          : w,
      );

      ctx.cookies.set(
        "const:session",
        JSON.stringify({ rules: gameSession.rules, words: newWords }),
        {
          expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
          path: "/",
          domain: `.${ctx.url.hostname}`,
          secure: import.meta.env.PROD,
        },
      );

      return {
        word: newWord,
        definition: newDefinition,
      };
    },
  }),
  dictionary: defineAction({
    accept: "form",
    input: z.object({
      word: z.string(),
    }),
    handler: (input, ctx) => {
      return defineWord(input.word);
    },
  }),
};
