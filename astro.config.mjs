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
  experimental: {
    session: true,
  },
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
    react({
      include: ["**/react/*"],
    }),
    solidJs({
      include: ["**/solid/*", "**/node_modules/@suid/material/**"],
    }),
    mdx(),
  ],
  output: "server",
  adapter: cloudflare({
    imageService: "compile",
  }),
  vite: {
    ssr: {
      noExternal: ["monaco-editor"],
    },
    plugins: [tailwindcss()],
    resolve: {
      // https://github.com/withastro/adapters/pull/436#issuecomment-2525190557
      // Use react-dom/server.edge instead of react-dom/server.browser for React 19.
      // Without this, MessageChannel from node:worker_threads needs to be polyfilled.
      alias: import.meta.env.PROD
        ? {
            "react-dom/server": "react-dom/server.edge",
          }
        : {},
    },
  },
});
