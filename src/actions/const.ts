import { keys } from "@/lib/const/rules";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { randomUUID } from "node:crypto";
import { db } from "@/db/drizzle";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { Words, type Word } from "@/db/schema";
import { site } from "@/config/site";
import type { Definition } from "@/lib/const/dictionary";

export const game = {
  new: defineAction({
    input: z.object({
      rules: z.array(z.enum(keys)),
    }),
    handler: async (input, ctx) => {
      return randomUUID();
    },
  }),
  words: defineAction({
    input: z.object({
      gameId: z.string().uuid(),
      max: z.number().int().positive().default(10),
    }),
    handler: async (input, ctx) => {
      const words = await db
        .select()
        .from(Words)
        .limit(input.max)
        .orderBy(asc(sql`RANDOM()`), asc(Words.sampled_count));

      await db
        .update(Words)
        .set({
          sampled_count: sql`${Words.sampled_count} + 1`,
          rejected_rate: sql`${Words.rejected_count} / ${Words.sampled_count}`,
        })
        .where(
          inArray(
            Words.id,
            words.map((word) => word.id),
          ),
        );

      ctx.cookies.set(`const:${input.gameId}`, JSON.stringify(words), {
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        path: "/",
        domain: `.${ctx.url.hostname}`,
        secure: import.meta.env.PROD,
      });

      return words;
    },
  }),
  swapOut: defineAction({
    accept: "form",
    input: z.object({
      gameId: z.string().uuid(),
      wordId: z.number().int(),
    }),
    handler: async (input, ctx) => {
      const words = ctx.cookies.get(`const:${input.gameId}`)?.json() as Word[];

      if (!words) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Game not found",
        });
      }

      const word = words.find((w) => w.id === input.wordId);

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
        .where(eq(Words.id, word.id));

      const [newWord] = await db
        .select()
        .from(Words)
        .orderBy(asc(sql`RANDOM()`))
        .limit(1);

      const newWords = words.map((w) => (w.id === input.wordId ? newWord : w));

      ctx.cookies.set(`const:${input.gameId}`, JSON.stringify(newWords), {
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
        path: "/",
        domain: `.${ctx.url.hostname}`,
        secure: import.meta.env.PROD,
      });

      return newWords;
    },
  }),
};
