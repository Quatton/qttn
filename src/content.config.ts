import { defineCollection } from 'astro:content';


import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const blog = defineCollection({ 
  loader: glob({ pattern: "**/*.{mdx,md}", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    createdAt: z.date(),
    publishedAt: z.date().optional(),
  }),
});

export const collections = { blog };