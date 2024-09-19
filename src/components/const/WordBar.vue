<script setup lang="ts">
import type { WordAndDefinition } from "@/lib/const/rules";
import { Icon } from "@iconify/vue";
import { actions } from "astro:actions";
import { ref } from "vue";
import { useAutoAnimate } from "@formkit/auto-animate/vue";
const $props = defineProps<{
  words: WordAndDefinition[];
}>();

const wordsRef = ref($props.words);

const updateWord = (word: WordAndDefinition, idx: number) => {
  wordsRef.value[idx] = word;
};

const isLoading = ref<number | false>(false);

const swapOutWord = async (idx: number) => {
  const { data } = await actions.constAction.swapOut({
    wordId: wordsRef.value[idx].word.id,
  });
  if (data) {
    updateWord(data, idx);
  }
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
</script>

<template>
  <div class="flex gap-2 flex-wrap justify-center text-xl" ref="parent">
    <div
      v-for="({ word, definition }, idx) in wordsRef"
      :key="word.id"
      class="border rounded-full flex items-center gap-2 p-2"
    >
      <div class="dropdown">
        <div tabindex="0" class="btn-xs btn btn-outline btn-error btn-circle">
          <Icon icon="heroicons:x-mark" />
        </div>
        <ul
          tabindex="0"
          class="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow"
        >
          <li>
            <button @click="swapOutWord(idx)">Too difficult</button>
          </li>
          <li>
            <button @click="swapOutWord(idx)">Is this a word?</button>
          </li>
        </ul>
      </div>
      {{ word.name }}
      <button
        class="btn-xs btn btn-outline btn-circle"
        @click="modal.showModal(idx)"
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
          <template v-if="definition">
            <h1>{{ definition?.word }}</h1>
            <p>{{ definition?.phonetic }}</p>
            <table class="table">
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
                        <li class="mb-4">
                          <p>{{ def.definition }}</p>
                          <p v-if="def.example">Example: {{ def.example }}</p>
                        </li>
                        <div
                          v-if="i < meaning.definitions.length - 1"
                          class="divider"
                        ></div>
                      </template>
                    </ul>
                  </td>
                </tr>
              </tbody>
            </table>
          </template>
          <div v-else>
            <h1>Word not found</h1>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  </div>
</template>
