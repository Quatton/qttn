<script lang="ts" setup>
import { wordStore } from "@/store/word";
import { useStore } from "@nanostores/vue";
import { shikiToMonaco } from "@shikijs/monaco";
import * as monaco from "monaco-editor";
import { createHighlighter } from "shiki";
import { onMounted, ref, shallowRef, watch } from "vue";

const element = ref<HTMLElement | null>(null);
const highlighter = await createHighlighter({
  themes: ["vitesse-dark"],
  langs: ["markdown"],
});

const editor = shallowRef<monaco.editor.IStandaloneCodeEditor | null>(null);
const editorDecorations =
  shallowRef<monaco.editor.IEditorDecorationsCollection | null>(null);
const $words = useStore(wordStore);

onMounted(() => {
  monaco.languages.register({ id: "markdown" });
  shikiToMonaco(highlighter, monaco);

  editor.value = monaco.editor.create(element.value as HTMLElement, {
    language: "markdown",
    fontFamily: "Geist Mono",
    fontSize: 18,
    wordBasedSuggestions: "off",
    minimap: { enabled: false },
    lineNumbers: "off",
    padding: { top: 16, bottom: 16 },
    placeholder: $words.value.map((word) => word.name).join("\n"),
    scrollBeyondLastLine: false,
  });

  editor.value.onDidChangeModelContent((e) => {
    const matches = editor.value
      ?.getModel()
      ?.findMatches(
        $words.value.map((word) => word.name).join("|"),
        true,
        true,
        true,
        " ",
        true,
      );

    editorDecorations.value?.clear();

    editorDecorations.value =
      editor.value?.createDecorationsCollection(
        matches?.map((match) => ({
          range: match.range,
          options: {
            isWholeLine: false,
            inlineClassName: "bracket-highlighting-1",
          },
        })),
      ) ?? null;

    const wordMatches = $words.value.map((word) => {
      return {
        ...word,
        match:
          (matches?.findIndex((match) => match.matches?.[0] === word.name) ??
            -1) !== -1,
      };
    });
    wordStore.set(wordMatches);
  });

  editor.value?.onDidDispose(() => {
    editorDecorations.value?.clear();
  });
});
</script>

<template>
  <div ref="element" class="h-full"></div>
</template>
