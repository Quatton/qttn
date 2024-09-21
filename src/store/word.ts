import { deepMap, map } from "nanostores";

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
