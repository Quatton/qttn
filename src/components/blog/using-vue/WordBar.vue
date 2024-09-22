<script setup lang="ts">
import { wordStore } from "@/store/word";
import { onMounted } from "vue";

const words = ["hello", "world", "foo", "bar"];

onMounted(() => {
  wordStore.value = words.map((word, idx) => ({
    id: idx,
    name: word,
    match: false,
  }));
});
</script>

<template>
  <ul class="flex flex-wrap gap-2">
    <li
      v-for="word in wordStore"
      :key="word.id"
      class="badge"
      :class="{ 'badge-primary': word.match }"
    >
      {{ word.name }}
    </li>
  </ul>
</template>
