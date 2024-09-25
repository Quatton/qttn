<script setup lang="ts">
import { useConstCode, usePastGames } from "@/hooks/vue/useConstCode";
import { actions } from "astro:actions";
import { navigate } from "astro:transitions/client";

const { latestGame } = usePastGames();
async function startNewGame() {
  if (latestGame.value) {
    const content = localStorage.getItem(`const:code:${latestGame.value}`);
    if (content) {
      await actions.constAction
        .updateGame({ id: latestGame.value, content })
        .catch(console.error);
      localStorage.removeItem(`const:code:${latestGame}`);
    }
  }
  const { data } = await actions.constAction.new({});

  if (data) navigate(`/game/${data}`);
}
</script>

<template>
  <button type="submit" class="btn btn-primary" @click="startNewGame">
    Start a new game
  </button>
</template>
