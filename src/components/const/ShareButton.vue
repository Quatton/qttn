<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { toPng } from "html-to-image";
import { ref } from "vue";
import { dataURItoBlob } from "@/lib/utils";
import { useLocalStorage } from "@vueuse/core";
import { actions } from "astro:actions";

const { gameId: id } = defineProps<{
  gameId: string;
}>();

const loading = ref(false);

const code = useLocalStorage("const:code", "");

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

async function download() {
  const dataUrl = await getDataUrl();

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `const-${id}.png`;
  link.click();
}

async function save() {
  await saveContent();
}

const modal = {
  open() {
    const el = document.getElementById("share-modal") as HTMLDialogElement;
    if (el) {
      el.showModal();
    }
  },
  close() {
    const el = document.getElementById("share-modal") as HTMLDialogElement;
    if (el) {
      el.close();
    }
  },
};

const openTooltip = useLocalStorage("const:tooltip", true);
</script>

<template>
  <div
    class="tooltip tooltip-top"
    data-tip="Download is now moved here"
    :class="{ 'tooltip-open': openTooltip }"
  >
    <button
      class="btn btn-primary w-full"
      :disabled="loading"
      @click="modal.open()"
      @mouseover="openTooltip = false"
    >
      <Icon icon="heroicons:share" />
      Share
    </button>
    <dialog class="modal" id="share-modal">
      <div class="modal-box">
        <h2 class="text-2xl font-bold">Share</h2>
        <p>Capture the content and share it with others.</p>
        <div class="mt-12 grid gap-2 md:grid-cols-2">
          <button class="btn" @click="share" :disabled="loading">
            <Icon icon="heroicons:share" />
            Share to other apps
          </button>
          <button class="btn" @click="download" :disabled="loading">
            <Icon icon="heroicons:arrow-down-tray" />
            Download
          </button>
          <form method="dialog" class="modal-backdrop">
            <button>close</button>
          </form>
        </div>
      </div>
    </dialog>
  </div>

  <button class="btn btn-secondary" @click="save" :disabled="loading">
    <Icon icon="heroicons:arrow-down-tray" />
    Save Content
  </button>
</template>
