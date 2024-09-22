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

export function usePastGames() {
  const games = useLocalStorage<string[]>("const:games", []);
  const latestGame = computed(() => games.value.at(-1));
  return {
    games,
    addGame(game: string) {
      if (games.value.includes(game)) return;
      games.value.push(game);
    },
    latestGame,
  };
}
