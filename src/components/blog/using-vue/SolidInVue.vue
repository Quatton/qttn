<script setup lang="ts">
import { testVue, increment } from "./hooks";
</script>

<template>
  <div class="flex items-center justify-center gap-4">
    <button class="btn" @click="increment">Increment</button>
    <p class="grid h-12 w-12 place-content-center rounded bg-base-200">
      {{ testVue }}
    </p>
  </div>
</template>
