<script setup lang="ts">
import type { UnwrapRef } from "vue";
import { getWords, returnWords, wordStore } from "./hooks";
import { useAutoAnimate } from "@formkit/auto-animate/vue";

const $props = defineProps<{
  words: UnwrapRef<typeof wordStore>;
}>();

wordStore.value = $props.words;

function swapOutWord(idx: number) {
  const [newWord] = getWords(1);
  returnWords([wordStore.value[idx]]);
  wordStore.value[idx] = {
    ...newWord,
    match: false,
  };
}

const [parent] = useAutoAnimate();
</script>

<template>
  <ul class="flex flex-wrap gap-2" ref="parent">
    <li
      role="button"
      v-for="(word, idx) in wordStore"
      :key="word.id"
      class="badge badge-lg animate-rotate-y animate-once"
      :class="{ 'badge-primary': word.match }"
      @click="swapOutWord(idx)"
    >
      {{ word.name }}
    </li>
  </ul>
</template>
