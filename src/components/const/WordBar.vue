<script setup lang="ts">
import type {
  CompressedWord,
  CompressedWordWithMatch,
  GameSession,
} from "@/lib/const/rules";
import { actions } from "astro:actions";
import { ref } from "vue";
import { useAutoAnimate } from "@formkit/auto-animate/vue";
import { useAsyncState } from "@vueuse/core";
import WordBadge from "./WordBadge.vue";
import { useInitWords } from "@/store/word";

const $props = defineProps<{
  words: CompressedWordWithMatch[];
  game: GameSession;
}>();

const wordStore = useInitWords($props.words);

const updateWord = (idx: number, word: CompressedWord) => {
  wordStore.value[idx] = {
    ...wordStore.value[idx],
    ...word,
  };
};

const isLoading = ref<number | false>(false);

const swapOutWord = async (
  idx: number,
  reason: "difficult" | "notAWord" | "inappropriate",
) => {
  isLoading.value = idx;
  const { data } = await actions.constAction.swapOut({
    gameId: $props.game.id,
    wordId: wordStore.value[idx].id,
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
</script>

<template>
  <div
    class="flex gap-2 @sm:gap-4 flex-wrap justify-center items-end"
    ref="parent"
  >
    <WordBadge
      v-for="(word, idx) in wordStore"
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
