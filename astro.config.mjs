// @ts-check
import cloudflare from "@astrojs/cloudflare";
import { satteri } from "@astrojs/markdown-satteri";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";
import { satteriStoryPages } from "./src/lib/satteri/story-pages.ts";

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
    processor: satteri({
      features: {
        math: true,
      },
      mdastPlugins: [satteriStoryPages()],
    }),
    syntaxHighlight: {
      excludeLangs: ["math"],
    },
  },
  image: {
    endpoint: {
      route: "/_image",
      entrypoint: "@astrojs/cloudflare/image-endpoint",
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
  integrations: [mdx(), react()],
});
