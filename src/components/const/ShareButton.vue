<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { toPng } from "html-to-image";
import { ref } from "vue";
import { dataURItoBlob } from "@/lib/utils";
import { useBrowserLocation, useLocalStorage } from "@vueuse/core";
import { actions } from "astro:actions";

const { gameId: id } = defineProps<{
  gameId: string;
}>();

const loading = ref(false);

const code = useLocalStorage("const:code", "");

const route = useBrowserLocation();

async function getDataUrl() {
  const el = document.getElementById("photoframe");
  if (!el) {
    throw new Error("Photo frame not found");
  }
  return await toPng(el, {
    quality: 1,
  });
} 

async function saveContent() {
  loading.value = true;
  await actions.constAction.updateGame.orThrow({
    id,
    content: code.value,
  });
  loading.value = false;
}

async function share() {
  await saveContent();
  const dataUrl = await getDataUrl();
  const file = new File([dataURItoBlob(dataUrl)], `const-${id}.png`, {
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

async function save() {
  await saveContent();
  const dataUrl = await getDataUrl();
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `const-${id}.png`;
  link.click();
}
</script>

<template>
  <div
    class="fixed z-50 inset-0 animate-fade bg-white animate-duration-100"
    v-if="loading"
  />

  <button class="btn btn-primary" @click="share" :disabled="loading">
    <Icon icon="heroicons:share" />
    Share
  </button>

  <button class="btn btn-secondary" @click="save" :disabled="loading">
    <Icon icon="heroicons:arrow-down-tray" />
    Save
  </button>
</template>
