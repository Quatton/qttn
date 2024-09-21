<script setup lang="ts">
import type {
  CompressedWord,
  CompressedWordWithMatch,
} from "@/lib/const/rules";
import { Icon } from "@iconify/vue";
import { actions } from "astro:actions";
import { computed, onMounted, ref, toRef, watch } from "vue";
import { useAutoAnimate } from "@formkit/auto-animate/vue";
import { reactiveComputed, useAsyncState } from "@vueuse/core";
import { useStore } from "@nanostores/vue";
import { wordStore } from "@/store/word";

const $props = defineProps<{
  words: CompressedWord[];
}>();

const wordsRef = useStore(wordStore);
const updateWord = (idx: number | string, word: CompressedWord) => {
  wordStore.setKey(`${idx}`, {
    ...word,
    match: false,
  });
};

const isLoading = ref<string | number | false>(false);

const swapOutWord = async (
  idx: number | string,
  reason: "difficult" | "notAWord" | "inappropriate",
) => {
  isLoading.value = idx;
  const { data } = await actions.constAction.swapOut({
    wordId: wordsRef.value[idx].id,
    reason,
  });
  if (data) {
    updateWord(idx, data);
    isLoading.value = false;
  }
};

const {
  state: definitions,
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
  showModal: (idx: number | string) => {
    (
      document.getElementById(`definition-${idx}`) as HTMLDialogElement
    ).showModal();
  },
  close: (idx: number | string) => {
    (document.getElementById(`definition-${idx}`) as HTMLDialogElement).close();
  },
};

onMounted(() => {
  $props.words.forEach((word, idx) => {
    wordStore.setKey(`${idx}`, {
      ...word,
      match: false,
    });
  });
});
</script>

<template>
  <div
    class="min-h-48 flex gap-2 @sm:gap-4 flex-wrap justify-center"
    ref="parent"
  >
    <div
      v-for="[idx, word] in Object.entries(wordsRef)"
      :key="word.id"
      class="border rounded-full flex items-center gap-2 p-2 bg-base-100 text-xs sm:text-sm md:text-base"
      :class="{
        'bg-green-200': !!wordsRef[idx]?.match,
      }"
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
            <button @click="swapOutWord(idx, 'difficult')">
              Too difficult
            </button>
          </li>
          <li>
            <button @click="swapOutWord(idx, 'notAWord')">
              Likely not a word
            </button>
          </li>
          <li>
            <button @click="swapOutWord(idx, 'inappropriate')">
              Report inappropriate
            </button>
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
        <div class="modal-box space-y-4 pt-8 h-96 flex flex-col">
          <button
            class="btn btn-ghost btn-circle btn-sm text-lg btn-error absolute top-2 left-2"
            aria-label="Close"
            @click="modal.close(idx)"
          >
            <Icon icon="heroicons:x-mark" class="text-error" />
          </button>
          <h1 class="text-2xl">{{ word.name }}</h1>
          <div
            class="flex-1 min-h-0 flex flex-col"
            v-if="definitions && definitions.length > 0"
            v-for="definition in definitions.slice(0, 1)"
          >
            <p class="text-muted-content">
              {{ definition.phonetic }}
            </p>
            <div class="flex-1 min-h-0 overflow-y-scroll">
              <table class="table max-sm:table-xs table-pin-rows">
                <template v-for="meaning in definition.meanings">
                  <thead>
                    <tr>
                      <th>{{ meaning.partOfSpeech }}</th>
                      <th>Definitions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(def, i) in meaning.definitions">
                      <td></td>
                      <td>
                        <ul>
                          <li :class="{ 'mt-2': i > 0 }">
                            <p>{{ def.definition }}</p>
                            <p v-if="def.example" class="mt-2">
                              <span class="badge badge-ghost badge-sm"
                                >Example</span
                              >
                              {{ def.example }}
                            </p>
                          </li>
                        </ul>
                      </td>
                    </tr>
                  </tbody>
                </template>
              </table>
            </div>
          </div>
          <div
            class="skeleton w-full h-full"
            v-else-if="definitionLoading"
          ></div>
          <div class="text-center h-full pt-28" v-else>
            (No definition found)
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  </div>
</template>
