import type { CompressedWordWithMatch } from "@/lib/const/rules";
import { ref } from "vue";

export const wordStore = ref<CompressedWordWithMatch[]>([]);

export function useInitWords(words: CompressedWordWithMatch[]) {
  wordStore.value = words;
  return wordStore;
}
