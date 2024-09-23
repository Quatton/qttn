<script lang="ts" setup>
import { useConstCode } from "@/hooks/vue/useConstCode";
import type { GameSession } from "@/lib/const/rules";
import { editor, wordStore } from "@/store/word";
import { shikiToMonaco } from "@shikijs/monaco";
import {
  breakpointsTailwind,
  useBreakpoints,
  useLocalStorage,
} from "@vueuse/core";
import * as monaco from "monaco-editor";
import { createHighlighter } from "shiki";
import { onMounted, onUnmounted, ref, shallowRef } from "vue";

const $props = defineProps<{
  game: GameSession;
}>();

const element = ref<HTMLElement | null>(null);

const editorDecorations =
  shallowRef<monaco.editor.IEditorDecorationsCollection | null>(null);

const breakpoint = useBreakpoints(breakpointsTailwind);

function onWindowResize(e: UIEvent) {
  editor.value?.layout();
  const parent = editor.value?.getDomNode()?.parentElement;
  editor.value?.updateOptions({
    fontSize:
      (parent ?? document.body).clientWidth > breakpointsTailwind.sm ? 16 : 12,
  });
}

const code = useConstCode($props.game.id, $props.game.content);

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
    fontSize: breakpoint.greaterOrEqual("sm").value ? 16 : 12,
    wordBasedSuggestions: "off",
    minimap: { enabled: false },
    lineNumbers: "off",
    padding: { top: 16, bottom: 16 },
    placeholder: "Type here...",
    scrollBeyondLastLine: false,
    automaticLayout: true,
    wordWrap: "on",
  });

  editor.value.onDidChangeModelContent((e) => {
    if (!editor.value) return;
    code.value = editor.value.getValue();

    const matches = editor.value
      .getModel()
      ?.findMatches(
        `(${wordStore.value
          .map((word) => word.name.replace(/[aeiou]$/, ""))
          .join("|")})[a-zA-Z.,;:!?'"-]*`,
        true,
        true,
        false,
        " ",
        true,
      );

    editorDecorations.value?.clear();

    if (matches) {
      editorDecorations.value = editor.value?.createDecorationsCollection(
        matches.map((match) => ({
          range: match.range,
          options: {
            isWholeLine: false,
            inlineClassName: `bracket-highlighting-${
              ((match.matches?.[0] ?? "")
                .split("")
                .reduceRight(
                  (acc: number, c: string) => acc * 31 + c.charCodeAt(0),
                  0,
                ) %
                6) +
              1
            }`,
          },
        })),
      );

      wordStore.value = wordStore.value.map((word) => ({
        ...word,
        match: code.value
          .toLowerCase()
          .includes(word.name.replace(/[aeiou]$/, "")),
      }));
    }

    window.addEventListener("resize", onWindowResize);
  });

  editor.value.setValue(code.value);

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
  <div
    ref="element"
    class="mx-auto h-64 w-[min(90%,64rem)] overflow-hidden rounded-xl bg-neutral shadow md:h-80"
    id="monaco-editor"
  ></div>
</template>
