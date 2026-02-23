import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/charts";
import { cn } from "@/lib/utils";
import { createAtom, useAtom } from "@xstate/store-react";
import { useCallback, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

const GRID_SIZE = 3;

const POSSIBLE_ANSWERS: [number, number][] = [
  [0, 0],
  [0, 1],
  [0, 2],
  [1, 2],
  [1, 1],
  [1, 0],
  [2, 0],
  [2, 1],
  [2, 2],
  [2, 1],
  [2, 0],
  [1, 0],
  [1, 1],
  [1, 2],
  [0, 2],
  [0, 1],
];

const prevAnswerIndexAtom = createAtom(POSSIBLE_ANSWERS.length - 1);

function sampleAnswerKey(): [number, number] {
  const prevAnswerIndex = prevAnswerIndexAtom.get();
  const nextAnswerIndex = (prevAnswerIndex + 1) % POSSIBLE_ANSWERS.length;
  prevAnswerIndexAtom.set(nextAnswerIndex);
  return POSSIBLE_ANSWERS[nextAnswerIndex];
}

type State =
  | {
      type: "GUESSING";
      answerKey: [number, number];
    }
  | {
      type: "CORRECT";
      answered: [number, number];
      answerKey: [number, number];
    }
  | {
      type: "INCORRECT";
      answered: [number, number];
      answerKey: [number, number];
    };

const STATE_FACTORY = {
  GUESSING: (answerKey: [number, number]): State => ({
    type: "GUESSING",
    answerKey,
  }),
  CORRECT: (answered: [number, number], answerKey: [number, number]): State => ({
    type: "CORRECT",
    answered,
    answerKey,
  }),
  INCORRECT: (answered: [number, number], answerKey: [number, number]): State => ({
    type: "INCORRECT",
    answered,
    answerKey,
  }),
};

const triesAtom = createAtom(0);
const numberOfCorrectAtom = createAtom(0);
const numberOfCorrectPerTriesAtom = createAtom<number[]>([]);
export function GuessBox() {
  const [state, setState] = useState<State>(() => STATE_FACTORY.GUESSING(sampleAnswerKey()));

  const tries = useAtom(triesAtom);
  const numberOfCorrect = useAtom(numberOfCorrectAtom);

  function setTries(newTries: number | ((prev: number) => number)) {
    triesAtom.set((prev) => {
      const nextTries = typeof newTries === "number" ? newTries : newTries(prev);

      if (state.type === "CORRECT") {
        numberOfCorrectAtom.set((prev) => prev + 1);
      }

      numberOfCorrectPerTriesAtom.set((prev) => {
        const next = [...prev];
        if (nextTries >= next.length) {
          next.push(prev[prev.length - 1] || 0);
        }
        if (state.type === "CORRECT") {
          next[nextTries] = (next[nextTries] || 0) + 1;
        }
        return next;
      });

      return nextTries;
    });
  }

  const handleGuess = useCallback(
    (row: number, col: number) => {
      setTries((prev) => prev + 1);

      let _state = state;

      if (state.type !== "GUESSING") {
        _state = STATE_FACTORY.GUESSING(sampleAnswerKey());
        setState(_state);
      }

      const answered: [number, number] = [row, col];
      const { answerKey } = _state;

      if (answered[0] === answerKey[0] && answered[1] === answerKey[1]) {
        setState(STATE_FACTORY.CORRECT(answered, answerKey));
      } else {
        setState(STATE_FACTORY.INCORRECT(answered, answerKey));
      }
    },
    [state],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="relative grid grid-cols-3 gap-2">
        {Array.from({ length: GRID_SIZE }).map((_, row) =>
          Array.from({ length: GRID_SIZE }).map((_, col) => {
            const isAnswered =
              state.type !== "GUESSING" && state.answered[0] === row && state.answered[1] === col;
            return (
              <button
                key={`${row}-${col}`}
                className={cn(
                  "btn h-24 w-24 text-3xl",
                  isAnswered && state.type === "CORRECT" && "btn-success",
                  isAnswered && state.type === "INCORRECT" && "btn-error",
                )}
                onClick={() => handleGuess(row, col)}
              >
                {state.type !== "GUESSING"
                  ? state.answerKey[0] === row && state.answerKey[1] === col
                    ? "⚽"
                    : ""
                  : null}
              </button>
            );
          }),
        )}
      </div>
      <div>
        <div className="text-3xl font-bold">
          {numberOfCorrect} / {tries} ({tries > 0 ? Math.round((numberOfCorrect / tries) * 100) : 0}
          %)
        </div>
      </div>
    </div>
  );
}

export function StatChart() {
  const numberOfCorrectPerTries = useAtom(numberOfCorrectPerTriesAtom);

  const chartData = numberOfCorrectPerTries.map((correct, tries) => ({
    tries: String(tries),
    rate: tries > 0 ? Math.round((correct / tries) * 100) : 0,
    baseline: Math.floor((1 / (GRID_SIZE * GRID_SIZE)) * 100),
  }));

  const chartConfig = {
    rate: {
      color: "var(--color-primary)",
    },
    baseline: {
      color: "var(--color-error)",
    },
  } satisfies ChartConfig;

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer config={chartConfig} className="z-30 mx-auto h-64 w-full max-w-sm">
        <LineChart width="100%" height="100%" accessibilityLayer data={chartData}>
          <CartesianGrid vertical={false} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} domain={[0, 100]} />
          <XAxis dataKey="tries" tickLine={false} axisLine={false} tickMargin={8} />
          <Line
            dataKey="rate"
            type="linear"
            stroke="var(--color-rate)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            dataKey="baseline"
            type="linear"
            stroke="var(--color-baseline)"
            strokeWidth={2}
            dot={false}
            strokeDasharray="4 2"
          />
        </LineChart>
      </ChartContainer>
      <div className="text-lg font-medium">Correct Guess Rate (%)</div>
    </div>
  );
}
