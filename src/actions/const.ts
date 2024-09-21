import { keys, type GameSession } from "@/lib/const/rules";
import {
  ActionError,
  defineAction,
  type ActionAPIContext,
} from "astro:actions";
import { z } from "astro/zod";
import { db } from "@/db/drizzle";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { now, Words } from "@/db/schema";
import type { Definition } from "@/lib/const/dictionary";
import { TimeSpan } from "oslo";

async function generateWords(limit: number) {
  const sq = db.$with("sq").as(
    db
      .select()
      .from(Words)
      .orderBy(asc(sql`RANDOM()`))
      .where(
        and(
          gte(Words.success_rate, 0),
          eq(Words.likely_not_a_word_count, 0),
          eq(Words.inappropriate_count, 0),
          gte(Words.sampled_count, 100),
        ),
      )
      .limit(limit * 5),
  );

  const words = await db
    .with(sq)
    .select({
      id: sq.id,
      name: sq.name,
      success_rate: sq.success_rate,
    })
    .from(sq)
    .orderBy(desc(sq.success_rate));

  const eighty = Math.floor(limit * 0.8);
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
      updated_at: now,
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

export const game = {
  new: defineAction({
    input: z
      .object({
        rules: z.array(z.enum(keys)).default(["useGivenWords"]),
        maxWords: z.number().int().positive().default(10),
        new: z.boolean().default(false),
      })
      .default({ rules: ["useGivenWords"], maxWords: 10 }),
    handler: async (input, ctx) => {
      fivePerFiveSeconds(ctx);

      const words =
        (!input.new
          ? (ctx.cookies.get("const:session")?.json() as GameSession).words
          : null) ?? (await generateWords(input.maxWords));

      ctx.cookies.set(
        "const:session",
        JSON.stringify({ rules: input.rules, words }),
        {
          expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
          path: "/",
          domain: `.${ctx.url.hostname}`,
          secure: import.meta.env.PROD,
        },
      );

      return words;
    },
  }),
  words: defineAction({
    input: z.object({
      max: z.number().int().positive().default(10),
    }),
    handler: async (input, ctx) => {
      fivePerFiveSeconds(ctx);

      const game: GameSession = ctx.cookies.get("const:session")?.json() ?? {
        rules: ["useGivenWords"],
        words: [],
      };

      if (game.words.length < input.max) {
        const newWords = await generateWords(input.max - game.words.length);
        game.words = [...game.words, ...newWords];
      }

      ctx.cookies.set(
        "const:session",
        JSON.stringify({
          ...game,
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
      reason: z.enum(["difficult", "notAWord", "inappropriate"]),
    }),
    handler: async (input, ctx) => {
      fivePerFiveSeconds(ctx);

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
          rejected_rate: sql`CAST (${Words.rejected_count} as REAL) / ${Words.sampled_count}`,
          likely_not_a_word_count:
            input.reason === "notAWord"
              ? sql`${Words.likely_not_a_word_count} + 1`
              : undefined,
          inappropriate_count:
            input.reason === "inappropriate"
              ? sql`${Words.inappropriate_count} + 1`
              : undefined,
          updated_at: now,
        })
        .where(eq(Words.id, word.id));

      const [newWord] = await db
        .select({
          id: Words.id,
          name: Words.name,
        })
        .from(Words)
        .where(
          and(
            gte(Words.success_rate, 0),
            eq(Words.likely_not_a_word_count, 0),
            eq(Words.inappropriate_count, 0),
            gte(Words.sampled_count, 100),
          ),
        )
        .orderBy(asc(Words.rejected_rate), asc(sql`RANDOM()`))
        .limit(1);

      const newWords = words.map((w) => (w.id === input.wordId ? newWord : w));

      ctx.cookies.set(
        "const:session",
        JSON.stringify({ ...game, words: newWords }),
        {
          expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
          path: "/",
          domain: `.${ctx.url.hostname}`,
          secure: import.meta.env.PROD,
        },
      );

      return newWord;
    },
  }),
  dictionary: defineAction({
    input: z.object({
      word: z.string(),
    }),
    handler: (input, ctx) => {
      fivePerFiveSeconds(ctx);
      return defineWord(input.word);
    },
  }),
};
