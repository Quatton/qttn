<script setup lang="ts">
import { usePastGames } from "@/hooks/vue/useConstCode";
import { actions } from "astro:actions";
import { navigate } from "astro:transitions/client";

const { games } = usePastGames();
async function startNewGame() {
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
}
</script>

<template>
  <button type="submit" class="btn btn-primary" @click="startNewGame">
    Start a new game
  </button>
</template>
