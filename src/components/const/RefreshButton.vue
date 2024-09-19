<script setup lang="ts">
import type { GameSession } from "@/lib/const/rules";
import { wordStore } from "@/store/word";
import { Icon } from "@iconify/vue";
import { useAsyncState, useLocalStorage } from "@vueuse/core";
import { actions } from "astro:actions";

const code = useLocalStorage("const:code", "");

const { error, isLoading, execute } = useAsyncState(
  async () => {
    return await actions.constAction.new.orThrow({
      new: true,
    });
  },
  undefined,
  { immediate: false },
);

const reset = async () => {
  const words = await execute();
  if (!words) {
    setTimeout(() => {
      error.value = false;
    }, 5000);
    return;
  }
  code.value = "";
  wordStore.set(words.map((word) => ({ ...word, match: false })));
};
</script>

<template>
  <button
    class="btn btn-outline"
    type="submit"
    @click="reset"
    :disabled="isLoading"
    :class="{ 'btn-disabled': isLoading }"
  >
    <Icon icon="heroicons:arrow-path" />
    Reset {{ error ? "(Slow down!)" : "" }}
  </button>
</template>
