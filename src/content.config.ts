import { defineCollection } from "astro:content";

import { glob } from "astro/loaders";
import { z } from "astro/zod";

const stories = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/stories" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    createdAt: z.coerce.date(),
    publishedAt: z.coerce.date().optional(),
    total: z.number(),
    issue: z.number().optional().default(1),
  }),
});

export const collections = { stories };
