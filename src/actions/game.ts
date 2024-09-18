import { keys } from "@/lib/const/rules";
import { defineAction } from "astro:actions";
import { z } from "astro/zod";
import { randomUUID } from "node:crypto";

export const game = {
  new: defineAction({
    input: z.object({
      rules: z.array(z.enum(keys)),
    }),
    handler: async (input, ctx) => {
      return randomUUID();
    },
  }),
};
