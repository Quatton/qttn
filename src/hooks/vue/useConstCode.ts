import { persistentMap } from "@nanostores/persistent";
import { computed as computedVue } from "vue";

export const codeStore = persistentMap<Record<string, string>>(
  "const:code:",
  {},
);

export function useConstCode(id: string, defaultValue = "") {
  return computedVue({
    get: () => codeStore.get()[id] ?? defaultValue,
    set: (value: string) => {
      codeStore.setKey(id, value);
    },
  });
}
