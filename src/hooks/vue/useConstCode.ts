import { useLocalStorage } from "@vueuse/core";
import { computed } from "vue";

export function useConstCode(id: string, defaultValue = "") {
  const key = `const:code:${id}`;
  const code = useLocalStorage(key, defaultValue);
  return computed({
    get: () => code.value,
    set: (value: string) => {
      code.value = value;
    },
  });
}
