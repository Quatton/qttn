// @ts-check
import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";
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
  },
  adapter: cloudflare(),
  security: {
    checkOrigin: true,
  },
  fonts: [
    {
      name: "Geist",
      cssVariable: "--font-geist",
      provider: fontProviders.fontsource(),
      weights: ["400", "500", "600", "700"],
    },
    {
      name: "Merriweather",
      cssVariable: "--font-merriweather",
      provider: fontProviders.fontsource(),
      weights: ["400", "700"],
    },
    {
      name: "IBM Plex Mono",
      cssVariable: "--font-plex-mono",
      provider: fontProviders.fontsource(),
    },
  ],
  integrations: [
    mdx({
      remarkPlugins: [remarkMath, remarkStoryPages],
      rehypePlugins: [rehypeKatex],
    }),
    react(),
  ],
});
