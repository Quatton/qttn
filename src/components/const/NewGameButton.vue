<script setup lang="ts">
import { usePastGames } from "@/hooks/vue/useConstCode";
import { useAsyncState } from "@vueuse/core";
import { actions } from "astro:actions";
import { navigate } from "astro:transitions/client";

const { games } = usePastGames();
const { execute, isLoading } = useAsyncState(
  async () => {
    await Promise.all(
      games.value.map(async (game) => {
        const content = localStorage.getItem(`const:code:${game}`);
        if (content && content.trim().length > 0) {
          await actions.constAction.updateGame({ id: game, content });
        }
        localStorage.removeItem(`const:code:${game}`);
      }),
    );
    const { data } = await actions.constAction.new({});
    if (data) navigate(`/game/${data}`);
  },
  undefined,
  {
    immediate: false,
  },
);
</script>

<template>
  <button
    type="submit"
    class="btn btn-primary"
    @click="() => execute()"
    :disabled="isLoading"
  >
    Start a new game
  </button>
</template>
