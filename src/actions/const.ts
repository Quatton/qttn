import { keys } from "@/lib/const/rules";
import { defineAction } from "astro:actions";
import { z } from "astro/zod";
import { randomUUID } from "node:crypto";
import { db } from "@/db/drizzle";
import { sql } from "drizzle-orm";

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
    input: z
      .object({
        max: z.number().int().positive().default(10),
      })
      .or(z.void()),
    handler: async (inp, ctx) => {
      const input = {
        max: 10,
      };
      return await db.query.Words.findMany({
        limit: input.max,
        orderBy: (fields, { asc }) => [
          asc(sql`RANDOM()`),
          asc(fields.sampled_count),
        ],
      });
    },
  }),
};
