import type { CompressedWordWithMatch } from "@/lib/const/rules";
import type { editor as module } from "monaco-editor";
import { ref, shallowRef, type Ref } from "vue";

export const wordStore = ref<CompressedWordWithMatch[]>([]);

export function useInitWords(words: CompressedWordWithMatch[]) {
  wordStore.value = words;
  return wordStore;
}

export const editor = shallowRef<module.IStandaloneCodeEditor | null>(null);
