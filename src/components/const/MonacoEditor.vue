<script lang="ts" setup>
import { wordStore } from "@/store/word";
import { useStore } from "@nanostores/vue";
import { shikiToMonaco } from "@shikijs/monaco";
import { useLocalStorage } from "@vueuse/core";
import * as monaco from "monaco-editor";
import { createHighlighter } from "shiki";
import { onMounted, onUnmounted, ref, shallowRef } from "vue";

const element = ref<HTMLElement | null>(null);

const editor = shallowRef<monaco.editor.IStandaloneCodeEditor | null>(null);
const editorDecorations =
  shallowRef<monaco.editor.IEditorDecorationsCollection | null>(null);
const $words = useStore(wordStore);

function onWindowResize() {
  editor.value?.layout();
}

const code = useLocalStorage("const:code", "");

onMounted(async () => {
  const highlighter = await createHighlighter({
    themes: ["vitesse-dark"],
    langs: ["markdown"],
  });

  monaco.languages.register({ id: "markdown" });
  shikiToMonaco(highlighter, monaco);

  editor.value = monaco.editor.create(element.value as HTMLElement, {
    value: code.value,
    language: "markdown",
    fontFamily: "Geist Mono",
    fontSize: 16,
    wordBasedSuggestions: "off",
    minimap: { enabled: false },
    lineNumbers: "off",
    padding: { top: 16, bottom: 16 },
    placeholder: "Type here...",
    scrollBeyondLastLine: false,
    automaticLayout: true,
  });

  editor.value.onDidChangeModelContent((e) => {
    code.value = editor.value?.getValue() ?? "";

    const matches = editor.value
      ?.getModel()
      ?.findMatches(
        $words.value.map((word) => word.name).join("|"),
        true,
        true,
        false,
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

    window.addEventListener("resize", onWindowResize);
  });

  editor.value?.onDidDispose(() => {
    editorDecorations.value?.clear();
  });
});

onUnmounted(() => {
  window.removeEventListener("resize", onWindowResize);
  editor.value?.dispose();
});
</script>

<template>
  <div ref="element" class="h-full"></div>
</template>
