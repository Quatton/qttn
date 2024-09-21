<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { toPng } from "html-to-image";
import { ref } from "vue";
import { alphabet, generateRandomString } from "oslo/crypto";
import { dataURItoBlob } from "@/lib/utils";
const loading = ref(false);

async function share() {
  const el = document.getElementById("photoframe");
  if (!el) return;
  loading.value = true;
  await new Promise((r) => setTimeout(r, 100));
  el.style.width = "360px";
  el.style.height = "640px";
  const dataUrl = await toPng(el, {
    canvasWidth: 720,
    canvasHeight: 1280,
    quality: 1,
    width: 360,
    height: 640,
  });
  el.style.width = "";
  el.style.height = "";
  loading.value = false;

  const id = generateRandomString(16, alphabet("a-z", "0-9"));

  const file = new File([dataURItoBlob(dataUrl)], `${id}.png`, {
    type: "image/png",
    lastModified: Date.now(),
  });

  const shareData = {
    title: `Const: ${id}`,
    files: [file],
  };

  if (navigator.canShare?.(shareData)) {
    await navigator.share(shareData);
    return;
  }
}
</script>

<template>
  <div
    class="fixed inset-0 animate-fade bg-white animate-duration-75"
    v-if="loading"
  />

  <button class="btn btn-primary" @click="share">
    <Icon icon="heroicons:share" />
    Share
  </button>
</template>
