<script lang="ts" setup>
import { apiBy, apiByURL, type Definition } from "@/lib/const/dictionary";
import type { CompressedWordWithMatch } from "@/lib/const/rules";
import { Icon } from "@iconify/vue";

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

const $emit = defineEmits<{
  defineWord: [word: string];
  swapOutWord: [
    idx: number,
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
    class="flex items-center gap-2 rounded-full border bg-base-100 p-2 text-xs sm:text-sm md:text-base"
    :class="{
      'bg-green-200': !!word.match,
    }"
  >
    <div class="dropdown">
      <div tabindex="0" class="btn btn-circle btn-outline btn-error btn-xs">
        <Icon icon="heroicons:x-mark" />
      </div>
      <ul
        tabindex="0"
        class="menu dropdown-content z-50 w-60 rounded-box bg-base-100 p-2 shadow"
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
      class="btn btn-circle btn-outline btn-xs"
      @click="
        $emit('defineWord', word.name);
        modal.showModal(idx);
      "
    >
      <Icon icon="heroicons:book-open" />
    </button>
    <dialog class="modal" :id="`definition-${idx}`">
      <div class="max-h-5/6 modal-box flex flex-col space-y-4 pt-8">
        <button
          class="btn btn-circle btn-ghost btn-error btn-sm absolute left-2 top-2 text-lg"
          aria-label="Close"
          @click="modal.close(idx)"
        >
          <Icon icon="heroicons:x-mark" class="text-error" />
        </button>
        <h1 class="text-2xl">{{ word.name }}</h1>
        <div
          class="flex min-h-0 flex-1 flex-col"
          v-if="definitions && definitions.length > 0"
          v-for="definition in definitions.slice(0, 1)"
        >
          <p class="text-muted-content">
            {{ definition.phonetic }}
          </p>
          <div class="min-h-0 flex-1 overflow-y-scroll">
            <table class="table table-pin-rows max-sm:table-xs">
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
            <p class="text-xs text-muted-content">
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
            <p class="text-xs text-muted-content">
              <a :href="source" target="_blank">{{ source }}</a>
            </p>
          </div>
          <p class="text-xs text-muted-content">
            Provided by <a :href="apiByURL" target="_blank">{{ apiBy }}</a>
          </p>
        </div>
        <div
          class="skeleton min-h-96 w-full"
          v-else-if="definitionLoading"
        ></div>
        <div class="h-full pt-28 text-center" v-else>(No definition found)</div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>
