<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { toPng } from "html-to-image";
import { ref } from "vue";
import { alphabet, generateRandomString } from "oslo/crypto";
import { dataURItoBlob } from "@/lib/utils";
import { useLocalStorage } from "@vueuse/core";
import { actions } from "astro:actions";
const loading = ref(false);

const code = useLocalStorage("const:code", "");

async function share() {
  await actions.constAction.saveContent.orThrow({
    content: code.value,
  });
  const el = document.getElementById("photoframe");
  if (!el) return;
  const dataUrl = await toPng(el, {
    quality: 1,
  });

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
    class="fixed z-50 inset-0 animate-fade bg-white animate-duration-75"
    v-if="loading"
  />

  <button class="btn btn-primary" @click="share">
    <Icon icon="heroicons:share" />
    Share
  </button>
</template>
