import type { CompressedWordWithMatch } from "@/lib/const/rules";
import { atom, deepMap } from "nanostores";

export const wordStore = deepMap<
  Record<
    string,
    {
      id: number;
      name: string;
      match: boolean;
    }
  >
>({});
