<script setup lang="ts">
import type {
  CompressedWord,
  CompressedWordWithMatch,
} from "@/lib/const/rules";
import { Icon } from "@iconify/vue";
import { actions } from "astro:actions";
import { computed, onMounted, ref, toRef, watch } from "vue";
import { useAutoAnimate } from "@formkit/auto-animate/vue";
import { useAsyncState } from "@vueuse/core";
import { useStore } from "@nanostores/vue";
import { wordStore } from "@/store/word";

const $props = defineProps<{
  words: CompressedWord[];
}>();

const $wordMatches = useStore(wordStore);
const wordsRef = computed({
  get: () => [...$wordMatches.value] as CompressedWordWithMatch[],
  set: (value) => {
    wordStore.set(value);
  },
});

const updateWord = (word: CompressedWord, idx: number) => {
  wordsRef.value[idx] = {
    ...word,
    match: false,
  };
};

const isLoading = ref<number | false>(false);

const swapOutWord = async (
  idx: number,
  reason: "difficult" | "notAWord" | "inappropriate",
) => {
  isLoading.value = idx;
  const { data } = await actions.constAction.swapOut({
    wordId: wordsRef.value[idx].id,
    reason,
  });
  if (data) {
    updateWord(data, idx);
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
  wordsRef.value = $props.words.map((word) => ({
    ...word,
    match: false,
  }));
});
</script>

<template>
  <div
    class="flex gap-4 flex-wrap justify-center text-xs md:text-sm lg:text-base"
    ref="parent"
  >
    <div
      v-for="(word, idx) in wordsRef"
      :key="word.id"
      class="border rounded-full flex items-center gap-2 p-2 bg-base-100"
      :class="{
        'bg-green-200': !!$wordMatches?.[idx]?.match,
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
      <dialog class="modal max-w-" :id="`definition-${idx}`">
        <div class="modal-box space-y-4 pt-8">
          <button
            class="btn btn-ghost btn-circle btn-sm text-lg btn-error absolute top-2 left-2"
            aria-label="Close"
            @click="modal.close(idx)"
          >
            <Icon icon="heroicons:x-mark" class="text-error" />
          </button>
          <h1 class="text-2xl">{{ word.name }}</h1>
          <div
            v-if="definitions && definitions.length > 0"
            v-for="definition in definitions.slice(0, 1)"
          >
            <p class="text-muted-content">
              {{ definition.phonetic }}
            </p>
            <div class="max-h-64 overflow-y-scroll">
              <table class="table max-sm:table-xs table-pin-rows">
                <thead>
                  <tr>
                    <th>Part of Speech</th>
                    <th>Definition</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="meaning in definition.meanings">
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
                            class="divider my-2"
                          ></div>
                        </template>
                      </ul>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div v-else-if="definitionLoading">
            <div class="skeleton w-full h-10"></div>
          </div>
          <div v-else>
            <div colspan="2" class="text-center">No definition found</div>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  </div>
</template>
