import { defineCollection } from "astro:content";

import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.{mdx,md}", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    createdAt: z.date(),
    description: z.string().optional(),
    publishedAt: z.date().optional(),
  }),
});

export const collections = { blog };
