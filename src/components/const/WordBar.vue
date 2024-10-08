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
import WordBadge from "./WordBadge.vue";
import { useInitWords } from "@/store/word";
import { usePastGames } from "@/hooks/vue/useConstCode";

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

const { addGame } = usePastGames();

onMounted(() => {
  addGame($props.game.id);
});
</script>

<template>
  <div
    class="flex flex-wrap items-end justify-center gap-2 @sm:gap-4"
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
    <div></div>
  </div>
</template>
