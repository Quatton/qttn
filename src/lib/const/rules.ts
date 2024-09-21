import type { Word } from "@/db/schema";
import type { Definition } from "./dictionary";

export const keys = ["beginWithLetter", "useGivenWords"] as const;

export type RuleType = (typeof keys)[number];

export const rules = {
  beginWithLetter: "Only begin with Letter [A-Z]",
  useGivenWords: "Use given words/phrases in order",
  // includeColor: "Include a color in every sentence",
  // includeNumber: "Include a number in every sentence",
  // syllableWords: "Only [number]-syllable words",
} as const satisfies Record<RuleType, string>;

export type WordAndDefinition = {
  word: Word;
  definition: Definition | null;
};

export type CompressedWord = Pick<Word, "id" | "name">;
export type CompressedWordWithMatch = CompressedWord & { match: boolean };

export type GameSession = {
  id: string;
};
