import { defineCollection, z } from "astro:content";

const blogCollection = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    createdAt: z.date(),
    publishedAt: z.date().optional(),
  }),
});

export const collections = {
  blog: blogCollection,
};
