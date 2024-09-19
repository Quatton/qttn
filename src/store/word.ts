import type { CompressedWord } from "@/lib/const/rules";
import { atom } from "nanostores";

export const wordStore = atom<CompressedWord[]>([]);
