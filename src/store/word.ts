import type { CompressedWordWithMatch } from "@/lib/const/rules";
import { atom } from "nanostores";

export const wordStore = atom<CompressedWordWithMatch[]>([]);
