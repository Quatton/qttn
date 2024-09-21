<script lang="ts" setup>
import { apiBy, apiByURL, type Definition } from "@/lib/const/dictionary";
import type { CompressedWordWithMatch } from "@/lib/const/rules";
import { Icon } from "@iconify/vue";

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

const $emit = defineEmits<{
  defineWord: [word: string];
  swapOutWord: [
    idx: number | string,
    reason: "difficult" | "notAWord" | "inappropriate",
  ];
}>();

withDefaults(
  defineProps<{
    idx: number;
    word: CompressedWordWithMatch;
    definitions?: Definition[] | null;
    definitionLoading?: boolean;
  }>(),
  {
    definitions: null,
    definitionLoading: false,
  },
);
</script>

<template>
  <div
    class="border rounded-full flex items-center gap-2 p-2 bg-base-100 text-xs sm:text-sm md:text-base"
    :class="{
      'bg-green-200': !!word.match,
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
          <button @click="$emit('swapOutWord', idx, 'difficult')">
            Too difficult
          </button>
        </li>
        <li>
          <button @click="$emit('swapOutWord', idx, 'notAWord')">
            Likely not a word
          </button>
        </li>
        <li>
          <button @click="$emit('swapOutWord', idx, 'inappropriate')">
            Report inappropriate
          </button>
        </li>
      </ul>
    </div>
    <div class="animate-rotate-y animate-once">{{ word.name }}</div>
    <button
      class="btn-xs btn btn-outline btn-circle"
      @click="
        $emit('defineWord', word.name);
        modal.showModal(idx);
      "
    >
      <Icon icon="heroicons:book-open" />
    </button>
    <dialog class="modal" :id="`definition-${idx}`">
      <div class="modal-box space-y-4 pt-8 max-h-5/6 flex flex-col">
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
          <div v-if="definition.license" class="mt-8">
            <p class="text-sm text-muted-content">
              Licensed under
              <a :href="definition.license.url" target="_blank">
                {{ definition.license.name }}
              </a>
            </p>
          </div>
          <div
            v-if="definition.sourceUrls"
            v-for="source in definition.sourceUrls"
          >
            <p class="text-sm text-muted-content">
              <a :href="source" target="_blank">{{ source }}</a>
            </p>
          </div>
          <p class="text-sm text-muted-content">
            Provided by <a :href="apiByURL" target="_blank">{{ apiBy }}</a>
          </p>
        </div>
        <div class="skeleton w-full h-full" v-else-if="definitionLoading"></div>
        <div class="text-center h-full pt-28" v-else>(No definition found)</div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>
