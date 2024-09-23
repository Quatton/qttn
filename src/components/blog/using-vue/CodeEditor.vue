<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { wordStore } from "./hooks";

const code = ref(
  "I ate a cake, and a banana ate me. Sandwich ate apple and pizza.",
);
const matchedAll = computed(
  () =>
    wordStore.value.length > 0 && wordStore.value.every((word) => word.match),
);
watch(
  () => code.value,
  () => {
    wordStore.value = wordStore.value.map((word) => ({
      ...word,
      match: code.value.toLowerCase().includes(word.name),
    }));
  },
  {
    immediate: true,
  },
);
</script>

<template>
  <textarea
    class="textarea textarea-bordered h-48 resize-none"
    placeholder="Enter some code here"
    v-model="code"
    :class="{
      'bg-green-200': matchedAll,
    }"
  ></textarea>
</template>
