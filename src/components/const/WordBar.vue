<script setup lang="ts">
import type {
  CompressedWord,
  CompressedWordWithMatch,
  GameSession,
} from "@/lib/const/rules";
import { actions } from "astro:actions";
import { onMounted, ref } from "vue";
import { useAutoAnimate } from "@formkit/auto-animate/vue";
import { useAsyncState } from "@vueuse/core";
import { useStore } from "@nanostores/vue";
import { wordStore } from "@/store/word";
import WordBadge from "./WordBadge.vue";
import type { Game } from "@/db/schema";

const $props = defineProps<{
  words: CompressedWordWithMatch[];
  game: GameSession;
}>();

const wordsRef = useStore(wordStore);
const updateWord = (idx: number | string, word: CompressedWord) => {
  wordStore.setKey(`${idx}`, {
    ...word,
    match: false,
  });
};

const isLoading = ref<string | number | false>(false);

const swapOutWord = async (
  idx: number | string,
  reason: "difficult" | "notAWord" | "inappropriate",
) => {
  isLoading.value = idx;
  const { data } = await actions.constAction.swapOut({
    gameId: $props.game.id,
    wordId: wordsRef.value[idx].id,
    reason,
  });
  if (data) {
    updateWord(idx, data);
    isLoading.value = false;
  }
};

const {
  state: definitions,
  execute,
  isLoading: definitionLoading,
} = useAsyncState(
  async (word: string) => {
    return await actions.constAction.dictionary.orThrow({ word });
  },
  null,
  {
    immediate: false,
    resetOnExecute: true,
  },
);

const defineWord = (word: string) => {
  execute(0, word);
};

const [parent] = useAutoAnimate();

onMounted(() => {
  $props.words.forEach((word, idx) => {
    wordStore.setKey(`${idx}`, {
      ...word,
      match: false,
    });
  });
});
</script>

<template>
  <div
    class="flex gap-2 @sm:gap-4 flex-wrap justify-center items-end"
    ref="parent"
  >
    <WordBadge
      v-for="(word, idx) in wordsRef"
      :key="word.id"
      :idx="idx"
      :word="word"
      :definitions="definitions"
      :definitionLoading="definitionLoading"
      @defineWord="defineWord"
      @swapOutWord="swapOutWord"
    />
    <div>

    </div>
  </div>
</template>
