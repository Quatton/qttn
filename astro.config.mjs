// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";
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

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  site: import.meta.env.DEV
    ? `http://${process.env.BASE_URL}`
    : `https://${process.env.BASE_URL}`,
  markdown: {
    shikiConfig: {
      theme: "vesper",
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
    icon(),
    vue({
      appEntrypoint: "./src/entrypoint/vue.ts",
    }),
    vtbot(),
    mdx(),
    solidJs({
      include: ["**/solid/*"],
    }),
    react({
      include: ["**/react/*"],
    }),
  ],
  output: "server",
  adapter: cloudflare({
    imageService: "cloudflare",
  }),
  vite: {
    ssr: {
      noExternal: ["monaco-editor"],
    },
    plugins: [tailwindcss()],
  },
});
