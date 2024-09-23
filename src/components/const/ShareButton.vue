<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { toPng } from "html-to-image";
import { ref } from "vue";
import { dataURItoBlob } from "@/lib/utils";
import { useClipboardItems, useLocalStorage } from "@vueuse/core";
import { actions } from "astro:actions";
import { useConstCode } from "@/hooks/vue/useConstCode";
import { editor } from "@/store/word";

const { gameId: id } = defineProps<{
  gameId: string;
}>();

const loading = ref(false);

const code = useConstCode(id);

async function getDataUrl() {
  if (!editor.value) {
    throw new Error("Editor not initialized");
  }
  const el = document.getElementById("photoframe") as HTMLDivElement;
  const editorHeight = editor.value.getScrollHeight();
  const editorElement = document.getElementById(
    "monaco-editor",
  ) as HTMLDivElement;
  const { height } = editorElement.getBoundingClientRect();
  const { height: frameHeight } = el.getBoundingClientRect();

  el.style.height = `${frameHeight + editorHeight - height}px`;

  loading.value = true;
  editorElement.classList.remove("h-64");
  editorElement.classList.remove("md:h-80");
  editorElement.classList.add("h-full");
  editor.value.layout();

  const data = await toPng(el, {
    quality: 1,
  });

  el.style.height = "";
  editorElement.classList.add("h-64");
  editorElement.classList.add("md:h-80");
  editorElement.classList.remove("h-full");

  loading.value = false;
  return data;
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

const clipboard = useClipboardItems();

async function copy() {
  const dataUrl = await getDataUrl();
  clipboard.copy([
    new ClipboardItem({
      "image/png": dataURItoBlob(dataUrl),
    }),
  ]);
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
    v-if="loading"
    class="fixed inset-0 animate-fade bg-white animate-duration-100 animate-once"
  ></div>
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
        <div class="mt-12 grid gap-2 md:grid-cols-2 md:grid-rows-1">
          <button class="btn col-span-2" @click="share" :disabled="loading">
            <Icon icon="heroicons:share" />
            Share to other apps
          </button>
          <button class="btn" @click="copy" :disabled="loading">
            <Icon icon="heroicons:clipboard" />
            Copy to clipboard
          </button>
          <button class="btn" @click="download" :disabled="loading">
            <Icon icon="heroicons:arrow-down-tray" />
            Download
          </button>
        </div>
      </div>

      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>

  <button class="btn btn-secondary" @click="save" :disabled="loading">
    <Icon icon="heroicons:arrow-down-tray" />
    Save Content
  </button>
</template>
