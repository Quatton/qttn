import { persistentMap } from "@nanostores/persistent";
import { computed as computedVue } from "vue";
import { computed } from "nanostores";

export const codeStore = persistentMap<Record<string, string>>(
  "const:code:",
  {},
);

export function useConstCode(id: string, defaultValue = "") {
  if (!codeStore.get()[id]) {
    codeStore.setKey(id, defaultValue);
  }
  const _code = computed(codeStore, (state) => state[id] ?? defaultValue);
  return computedVue({
    get: () => _code.value ?? defaultValue,
    set: (value: string) => {
      codeStore.setKey(id, value);
    },
  });
}
