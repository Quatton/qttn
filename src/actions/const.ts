import { keys, type GameSession } from "@/lib/const/rules";
import {
  ActionError,
  defineAction,
  type ActionAPIContext,
} from "astro:actions";
import { z } from "astro/zod";
import { db } from "@/db/drizzle";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { Words, type Word } from "@/db/schema";
import type { Definition } from "@/lib/const/dictionary";
import { TimeSpan } from "oslo";

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
    .select({
      id: sq.id,
      name: sq.name,
    })
    .from(sq)
    .orderBy(
      asc(sq.inappropriate_count),
      asc(sq.likely_not_a_word_count),
      asc(sq.sampled_count),
      asc(sq.rejected_rate),
    )
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

const fiveSeconds = ratelimiter(new TimeSpan(5, "s"), 1);
const fivePerFiveSeconds = ratelimiter(new TimeSpan(5, "s"), 5);

export const game = {
  new: defineAction({
    input: z
      .object({
        rules: z.array(z.enum(keys)).default(["useGivenWords"]),
        maxWords: z.number().int().positive().default(10),
      })
      .default({ rules: ["useGivenWords"], maxWords: 10 }),
    handler: async (input, ctx) => {
      fivePerFiveSeconds(ctx);

      const words = await generateWords(input.maxWords);

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
          rejected_rate: sql`CASE WHEN ${Words.sampled_count} = 0 THEN 0 ELSE (${Words.rejected_count} + 1) / ${Words.sampled_count} END`,
          likely_not_a_word_count:
            input.reason === "notAWord"
              ? sql`${Words.likely_not_a_word_count} + 1`
              : undefined,
        })
        .where(eq(Words.id, word.id));

      const [newWord] = await db
        .select({
          id: Words.id,
          name: Words.name,
        })
        .from(Words)
        .orderBy(
          asc(Words.inappropriate_count),
          asc(Words.likely_not_a_word_count),
          asc(Words.sampled_count),
          asc(Words.rejected_rate),
          asc(sql`RANDOM()`),
        )
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
