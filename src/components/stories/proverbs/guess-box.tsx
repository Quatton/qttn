import { cn } from "@/lib/utils";
import { useState } from "react";

const STATE_FACTORY = {
  GUESSING: (answerKey: [number, number]) => ({
    type: "GUESSING" as const,
    answerKey
  }),
  CORRECT: (answered: [number, number], answerKey: [number, number]) => ({
    type: "CORRECT" as const,
    answered,
    answerKey
  }),
  INCORRECT: (answered: [number, number], answerKey: [number, number]) => ({
    type: "INCORRECT" as const,
    answered,
    answerKey
  })
};

type State =
  | ReturnType<typeof STATE_FACTORY.GUESSING>
  | ReturnType<typeof STATE_FACTORY.CORRECT>
  | ReturnType<typeof STATE_FACTORY.INCORRECT>;

const GRID_SIZE = 5;

function sampleAnswerKey(): [number, number] {
  const row = GRID_SIZE - 1;
  const col = Math.floor(Math.random() * GRID_SIZE);
  return [row, col];
}

export function GuessBox() {
  const [state, setState] = useState<State>(() =>
    STATE_FACTORY.GUESSING(sampleAnswerKey())
  );

  const [tries, _setTries] = useState(0);
  const [numberOfCorrect, setNumberOfCorrect] = useState(0);
  const [numberOfCorrectPerTries, setNumberOfCorrectPerTries] = useState<
    number[]
  >([]);

  function setTries(newTries: number | ((prev: number) => number)) {
    _setTries((prev) => {
      const nextTries =
        typeof newTries === "number" ? newTries : newTries(prev);
      if (state.type === "CORRECT") {
        setNumberOfCorrect((prev) => prev + 1);
        setNumberOfCorrectPerTries((prev) => {
          const newData = [...prev];
          newData[nextTries] = (newData[nextTries] || 0) + 1;
          return newData;
        });
      }
      return nextTries;
    });
  }

  function handleGuess(row: number, col: number) {
    if (state.type !== "GUESSING") {
      setState(STATE_FACTORY.GUESSING(sampleAnswerKey()));
      setTries((prev) => prev + 1);
      return;
    }

    const answered: [number, number] = [row, col];
    const { answerKey } = state;

    if (answered[0] === answerKey[0] && answered[1] === answerKey[1]) {
      setState(STATE_FACTORY.CORRECT(answered, answerKey));
    } else {
      setState(STATE_FACTORY.INCORRECT(answered, answerKey));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: GRID_SIZE }).map((_, row) =>
          Array.from({ length: GRID_SIZE }).map((_, col) => {
            const isAnswered =
              state.type !== "GUESSING" &&
              state.answered[0] === row &&
              state.answered[1] === col;
            return (
              <button
                key={`${row}-${col}`}
                className={cn(
                  "btn h-12 w-12",
                  isAnswered && state.type === "CORRECT" && "btn-success",
                  isAnswered && state.type === "INCORRECT" && "btn-error"
                )}
                onClick={() => handleGuess(row, col)}
              >
                {state.type !== "GUESSING" &&
                state.answerKey[0] === row &&
                state.answerKey[1] === col
                  ? "⚽"
                  : ""}
              </button>
            );
          })
        )}
      </div>
      <div className="text-center">Click the grid again to reset.</div>
    </div>
  );
}
