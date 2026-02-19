// @ts-check
import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { remarkStoryPages } from "./src/lib/remark/story-pages.mjs";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": "/src",
      },
    },
  },
  markdown: {
    syntaxHighlight: {
      excludeLangs: ["math"],
    },
    gfm: true,
    remarkPlugins: [remarkMath, remarkStoryPages],
    rehypePlugins: [rehypeKatex],
  },
  adapter: cloudflare({
    imageService: "compile",
  }),
  integrations: [mdx(), react()],
});
