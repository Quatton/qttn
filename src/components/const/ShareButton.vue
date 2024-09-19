<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { toPng } from "html-to-image";
import { ref } from "vue";

const loading = ref(false);

async function share() {
  const el = document.querySelector("section");
  if (!el) return;

  loading.value = true;
  el.style.width = "360px";
  el.style.height = "640px";
  await toPng(el).then((dataUrl) => {
    const link = document.createElement("a");
    link.download = "share.png";
    link.href = dataUrl;

    link.click();
  });

  el.style.width = "";
  el.style.height = "";
  loading.value = false;
}
</script>

<template>
  <div class="fixed inset-0 animate-fade bg-white" v-if="loading" />

  <button class="btn btn-primary" @click="share">
    <Icon icon="heroicons:share" />
    Share
  </button>
</template>
