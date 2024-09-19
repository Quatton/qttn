<script setup lang="ts">
import type { CompressedWord } from "@/lib/const/rules";
import { Icon } from "@iconify/vue";
import { actions } from "astro:actions";
import { onMounted, ref, watch } from "vue";
import { useAutoAnimate } from "@formkit/auto-animate/vue";
import { useAsyncState } from "@vueuse/core";
import { useStore } from "@nanostores/vue";
import { wordStore } from "@/store/word";

const $props = defineProps<{
  words: CompressedWord[];
}>();

const wordsRef = ref($props.words);

const updateWord = (word: CompressedWord, idx: number) => {
  wordsRef.value[idx] = word;
};

const isLoading = ref<number | false>(false);

const swapOutWord = async (idx: number) => {
  isLoading.value = idx;
  const { data } = await actions.constAction.swapOut({
    wordId: wordsRef.value[idx].id,
  });
  if (data) {
    updateWord(data, idx);
    isLoading.value = false;
  }
};

const {
  state: definition,
  execute,
  isLoading: definitionLoading,
} = useAsyncState(
  async (word: string) => {
    return await actions.constAction.dictionary.orThrow({ word });
  },
  null,
  {
    immediate: false,
    resetOnExecute: true,
  },
);

const defineWord = (word: string) => {
  execute(0, word);
};

const [parent] = useAutoAnimate();

const modal = {
  showModal: (idx: number) => {
    (
      document.getElementById(`definition-${idx}`) as HTMLDialogElement
    ).showModal();
  },
  close: (idx: number) => {
    (document.getElementById(`definition-${idx}`) as HTMLDialogElement).close();
  },
};

onMounted(() => {
  wordStore.set(wordsRef.value);
});
</script>

<template>
  <div class="flex gap-4 flex-wrap justify-center text-xl" ref="parent">
    <div
      v-for="(word, idx) in wordsRef"
      :key="word.id"
      class="border rounded-full flex items-center gap-2 p-2 bg-base-100"
    >
      <div class="dropdown">
        <div tabindex="0" class="btn-xs btn btn-outline btn-error btn-circle">
          <Icon icon="heroicons:x-mark" />
        </div>
        <ul
          tabindex="0"
          class="dropdown-content menu bg-base-100 rounded-box z-50 w-60 p-2 shadow"
        >
          <li>
            <button @click="swapOutWord(idx)">Too difficult</button>
          </li>
          <li>
            <button @click="swapOutWord(idx)">Is this a word?</button>
          </li>
        </ul>
      </div>
      <div class="animate-rotate-y animate-once">{{ word.name }}</div>
      <button
        class="btn-xs btn btn-outline btn-circle"
        @click="
          defineWord(word.name);
          modal.showModal(idx);
        "
      >
        <Icon icon="heroicons:book-open" />
      </button>
      <dialog class="modal" :id="`definition-${idx}`">
        <div class="modal-box pt-16">
          <button
            class="btn btn-ghost btn-circle btn-sm text-lg btn-error absolute top-2 left-2"
            aria-label="Close"
            @click="modal.close(idx)"
          >
            <Icon icon="heroicons:x-mark" class="text-error" />
          </button>
          <h1>{{ word.name }}</h1>
          <p class="text-sm text-muted-content">{{ definition?.phonetic }}</p>
          <table class="table">
            <thead>
              <tr>
                <th>Part of Speech</th>
                <th>Definition</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="definition" v-for="meaning in definition.meanings">
                <td>{{ meaning.partOfSpeech }}</td>
                <td>
                  <ul>
                    <template v-for="(def, i) in meaning.definitions">
                      <li :class="{ 'mt-2': i > 0 }">
                        <p>{{ def.definition }}</p>
                        <p v-if="def.example" class="mt-2">
                          <span class="badge badge-ghost">Example</span>
                          {{ def.example }}
                        </p>
                      </li>
                      <div
                        v-if="i < meaning.definitions.length - 1"
                        class="divider"
                      ></div>
                    </template>
                  </ul>
                </td>
              </tr>
              <tr v-else-if="definitionLoading">
                <td colspan="2">
                  <div class="skeleton w-full h-10"></div>
                </td>
              </tr>
              <tr v-else>
                <td colspan="2" class="text-center">No definition found</td>
              </tr>
            </tbody>
          </table>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  </div>
</template>
