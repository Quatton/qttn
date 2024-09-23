// @ts-check
import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";
import vercel from "@astrojs/vercel/serverless";
import svelte from "@astrojs/svelte";
import icon from "astro-icon";
import vue from "@astrojs/vue";
import vtbot from "astro-vtbot";

import mdx from "@astrojs/mdx";

import {
  transformerMetaWordHighlight,
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";

import solidJs from "@astrojs/solid-js";

// https://astro.build/config
export default defineConfig({
  site: import.meta.env.DEV
    ? `http://${process.env.BASE_URL}`
    : `https://${process.env.BASE_URL}`,
  markdown: {
    shikiConfig: {
      theme: "catppuccin-mocha",
      wrap: true,
      transformers: [
        transformerNotationDiff({
          classLineAdd: "gdiff add",
          classLineRemove: "gdiff remove",
        }),
        transformerMetaWordHighlight(),
        transformerNotationHighlight(),
        transformerNotationWordHighlight(),
      ],
    },
  },
  integrations: [
    tailwind(),
    svelte(),
    icon(),
    vue({
      appEntrypoint: "./src/entrypoint/vue.ts",
    }),
    vtbot(),
    mdx(),
    solidJs(),
  ],
  output: "server",
  adapter: vercel({
    webAnalytics: { enabled: true },
  }),
  vite: {
    ssr: {
      noExternal: ["monaco-editor"],
    },
  },
});
