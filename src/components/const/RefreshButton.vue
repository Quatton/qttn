<script setup lang="ts">
import type { GameMode } from "@/db/schema";
import { useConstCode } from "@/hooks/vue/useConstCode";
import { wordStore } from "@/store/word";
import { Icon } from "@iconify/vue";
import { useAsyncState } from "@vueuse/core";
import { actions } from "astro:actions";
import { computed, ref } from "vue";

const $props = defineProps<{
  gameId: string,
  mode: GameMode,
}>();

const mode = ref($props.mode);

const { error, isLoading: isResetLoading, execute } = useAsyncState(
  async () => {
    return await actions.constAction.words.orThrow({
      gameId: $props.gameId,
    });
  },
  undefined,
  { immediate: false },
);

const { isLoading: isHarderLoading, execute: executeSwitchDifficulty } = useAsyncState(
  async () => {
    if (!$props.gameId) {
      return;
    }
    return await actions.constAction.updateGame.orThrow({
      id: $props.gameId,
      mode: mode.value === "easy" ? "hard" : "easy",
    });
  },
  undefined,
  { immediate: false },
);

const isLoading = computed(() => isResetLoading.value || isHarderLoading.value);

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
  words.forEach((word, idx) => {
    wordStore.setKey(`${idx}`, {
      ...word,
      match: false,
    });
  });
};

const switchDifficulty = async () => {
  const confirm = window.confirm(
    "Are you sure you want to make the game harder? To prevent removing words accidentally, you will need to reset it yourself.",
  );
  if (!confirm) {
    return;
  }
  const game = await executeSwitchDifficulty();
  if (!game) {
    return;
  }
  mode.value = game.mode;
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
    Reset {{ error ? "(Error!)" : "" }}
  </button>
  <button
    class="btn btn-outline"
    type="submit"
    @click="switchDifficulty"
    :disabled="isLoading"
    :class="{ 'btn-disabled': isLoading }"
  >
    <Icon icon="heroicons:arrow-uturn-down" v-if="mode === 'hard'" />
    <Icon icon="heroicons:arrow-uturn-up" v-else />
    <span v-if="mode === 'easy'">Make harder</span>
    <span v-else>Make easier</span>
  </button>
</template>
