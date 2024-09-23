<script lang="ts" setup>
import { usePastGames } from "@/hooks/vue/useConstCode";

const { latestGame: gameId } = usePastGames();
</script>

<template>
  <a v-if="gameId" :href="`/game/${gameId}`" class="btn btn-outline">
    Continue where you left off
  </a>
</template>
