<script lang="ts" setup>
  import { useConstCode } from "@/hooks/vue/useConstCode";
  import type { GameSession } from "@/lib/const/rules";
  import { editor, wordStore } from "@/store/word";
  import { shikiToMonaco } from "@shikijs/monaco";
  import { breakpointsTailwind, useBreakpoints } from "@vueuse/core";
  import * as monaco from "monaco-editor";
  import { createHighlighter } from "shiki";
  import { onMounted, onUnmounted, ref, shallowRef } from "vue";

  const $props = defineProps<{
    game: GameSession;
  }>();

  const element = ref<HTMLElement | null>(null);
  const isEditorLoading = ref(true);
  const editorInitError = ref<string | null>(null);

  const editorDecorations =
    shallowRef<monaco.editor.IEditorDecorationsCollection | null>(null);

  const breakpoint = useBreakpoints(breakpointsTailwind);

  function onWindowResize() {
    editor.value?.layout();
    const parent = editor.value?.getDomNode()?.parentElement;
    editor.value?.updateOptions({
      fontSize:
        (parent ?? document.body).clientWidth > breakpointsTailwind.sm
          ? 16
          : 12,
    });
  }

  const code = useConstCode($props.game.id, $props.game.content);

  onMounted(async () => {
    try {
      const highlighter = await createHighlighter({
        themes: ["vitesse-dark"],
        langs: ["markdown"],
      });

      monaco.languages.register({ id: "markdown" });
      shikiToMonaco(highlighter, monaco);

      if (!element.value) {
        throw new Error("Monaco root element not found");
      }

      editor.value = monaco.editor.create(element.value, {
        value: code.value,
        language: "markdown",
        fontFamily: "Geist Mono Variable",
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

      window.addEventListener("resize", onWindowResize);

      editor.value.onDidChangeModelContent(() => {
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
      });

      editor.value.setValue(code.value);

      editor.value?.onDidDispose(() => {
        editorDecorations.value?.clear();
      });
    } catch (e) {
      console.error(e);
      editorInitError.value = "Failed to load editor.";
    } finally {
      isEditorLoading.value = false;
    }
  });

  onUnmounted(() => {
    window.removeEventListener("resize", onWindowResize);
    editor.value?.dispose();
  });
</script>

<template>
  <div
    class="bg-neutral mx-auto relative h-64 w-[min(90%,64rem)] overflow-hidden rounded-xl shadow-md md:h-80"
  >
    <div ref="element" class="h-full w-full" id="monaco-editor"></div>
    <div
      v-if="isEditorLoading"
      class="absolute inset-0 flex items-center justify-center"
      id="monaco-editor-loading"
    >
      Loading editor...
    </div>
    <div
      v-else-if="editorInitError"
      class="absolute inset-0 flex items-center justify-center"
      id="monaco-editor-error"
    >
      {{ editorInitError }}
    </div>
  </div>
</template>
