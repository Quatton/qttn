import { writable } from "svelte/store";
import { ref, watch } from "vue";
import { createSignal } from "solid-js";

type Word = {
  id: number;
  name: string;
  match: boolean;
};

export const wordStore = ref<Word[]>([]);
export const useWordStore = (words: string[]) => {
  wordStore.value = words.map((word, idx) => ({
    id: idx,
    name: word,
    match: false,
  }));
  return wordStore;
};

export const db = [
  "cake",
  "sandwich",
  "apple",
  "banana",
  "pizza",
  "pasta",
  "hello",
  "world",
  "foo",
  "bar",
].map((word, id) => ({
  id,
  name: word,
}));

const allWords = ref(db.slice(5));

export const [test, setTest] = createSignal(0);
export const testVue = ref(0);
export function increment() {
  testVue.value++;
}
watch(
  () => testVue.value,
  (val) => {
    setTest(val);
  },
);

export function getWords(limit: number, random = true) {
  const randomWords = [];
  if (random) allWords.value.sort(() => Math.random() - 0.5);
  for (let i = 0; i < limit; i++) {
    const pop = allWords.value.pop();
    if (pop) randomWords.push(pop);
  }
  return randomWords;
}

export function returnWords(words: Word[]) {
  allWords.value = allWords.value.concat(words);
}

export const svelteStore = writable<Word[]>([]);
