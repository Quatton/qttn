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

import rehypeMermaid from "rehype-mermaid";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import { loadEnv } from "vite";

const { PUBLIC_BASE_URL } = loadEnv(
  // @ts-ignore
  process.env.NODE_ENV,
  process.cwd(),
  "PUBLIC_BASE_URL"
);

// https://astro.build/config
export default defineConfig({
  site: import.meta.env.DEV
    ? `http://${PUBLIC_BASE_URL}`
    : `https://${PUBLIC_BASE_URL}`,
  markdown: {
    syntaxHighlight: {
      excludeLangs: ["mermaid", "math"],
    },
    // gfm: true,
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeMermaid, rehypeKatex],
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
