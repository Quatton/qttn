// @ts-check
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

import cloudflare from "@astrojs/cloudflare";

import mdx from "@astrojs/mdx";
import { remarkStoryPages } from "./src/lib/remark/story-pages.mjs";

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
  adapter: cloudflare({
    imageService: "compile",
  }),
  integrations: [
    mdx({
      remarkPlugins: [remarkStoryPages],
    }),
  ],
});
