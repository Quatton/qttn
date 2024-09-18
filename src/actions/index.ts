import { keys, rules } from "@/lib/const/rules";
import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import { randomUUID } from "node:crypto";

export const server = {
  createNewGame: defineAction({
    input: z.object({
      rules: z.array(z.enum(keys)),
    }),
    handler: async (input, ctx) => {
      return randomUUID();
    },
  }),
};
