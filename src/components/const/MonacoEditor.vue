<script lang="ts" setup>
import { shikiToMonaco } from "@shikijs/monaco";
import * as monaco from "monaco-editor";
import { createHighlighter } from "shiki";
import { onMounted, ref } from "vue";

const element = ref<HTMLElement | null>(null);
const highlighter = await createHighlighter({
  themes: ["vitesse-dark"],
  langs: ["markdown"],
});

const options: monaco.editor.IStandaloneEditorConstructionOptions = {
  language: "markdown",
  fontFamily: "Geist Mono",
  fontSize: 18,
  wordBasedSuggestions: "off",
  minimap: { enabled: false },
  lineNumbers: "off",
  padding: { top: 16, bottom: 16 },
  placeholder: "Write your story here...",
  scrollBeyondLastLine: false,
};

onMounted(() => {
  monaco.languages.register({ id: "markdown" });
  shikiToMonaco(highlighter, monaco);
  monaco.editor.create(element.value as HTMLElement, options);
});
</script>

<template>
  <div ref="element" class="h-full"></div>
</template>
