<script setup lang="ts">
import { useConstCode } from "@/hooks/vue/useConstCode";
import type { GameSession } from "@/lib/const/rules";
import { wordStore } from "@/store/word";
import { Icon } from "@iconify/vue";
import { useAsyncState, useLocalStorage } from "@vueuse/core";
import { actions } from "astro:actions";
import { computed } from "vue";

const id = computed(() => window.location.pathname.split("/").pop());
const code = useConstCode(id.value ?? "");

const { error, isLoading, execute } = useAsyncState(
  async () => {
    return await actions.constAction.words.orThrow({
      gameId: id.value ?? "",
    });
  },
  undefined,
  { immediate: false },
);

const reset = async () => {
  const confirm = window.confirm(
    "Are you sure you want to reset the game? This will remove all words and start a new game.",
  );
  if (!confirm) {
    return;
  }
  const words = await execute();
  if (!words) {
    setTimeout(() => {
      error.value = false;
    }, 5000);
    return;
  }
  code.value = "";
  words.forEach((word, idx) => {
    wordStore.setKey(`${idx}`, {
      ...word,
      match: false,
    });
  });
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
