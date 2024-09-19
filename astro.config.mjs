// @ts-check
import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";

import vercel from "@astrojs/vercel/serverless";

import svelte from "@astrojs/svelte";

import icon from "astro-icon";

import vue from "@astrojs/vue";

import vtbot from "astro-vtbot";

import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

// https://astro.build/config
export default defineConfig({
	site: import.meta.env.DEV
		? `http://${process.env.BASE_URL}`
		: `https://${process.env.BASE_URL}`,
	integrations: [
		tailwind({
			applyBaseStyles: false,
		}),
		svelte(),
		icon(),
		vue(),
		vtbot(),
	],
	output: "server",
	adapter: vercel(),
});
