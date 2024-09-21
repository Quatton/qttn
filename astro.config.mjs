// @ts-check
import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";
import vercel from "@astrojs/vercel/serverless";
import svelte from "@astrojs/svelte";
import icon from "astro-icon";
import vue from "@astrojs/vue";
import vtbot from "astro-vtbot";

// https://astro.build/config
export default defineConfig({
  site: import.meta.env.DEV
    ? `http://${process.env.BASE_URL}`
    : `https://${process.env.BASE_URL}`,
  integrations: [
    tailwind(),
    svelte(),
    icon(),
    vue({
      appEntrypoint: "./src/entrypoint/vue.ts",
    }),
    vtbot(),
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
