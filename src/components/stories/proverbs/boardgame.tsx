import { ChessPiece } from "@/components/ui/chess-pieces";
import { cn } from "@/lib/utils";

export function TicTacToe({ state }: { state: ("X" | "O" | null)[] }) {
  return (
    <div className="grid grid-cols-3 border-collapse gap-0.5">
      {state.map((cell, i) => (
        <div
          key={i}
          className={cn(
            "w-16 h-16 border border-gray-500 flex items-center justify-center text-2xl font-bold",
            cell === "X"
              ? "text-blue-500"
              : cell === "O"
                ? "text-red-500"
                : "text-gray-500"
          )}
        >
          {cell}
        </div>
      ))}
    </div>
  );
}

export function ChessBoard({ fen }: { fen: string }) {
  const state = fen
    .split(" ")[0]
    .split("/")
    .map((row) =>
      row.split("").flatMap((cell) => {
        if (isNaN(Number(cell))) {
          return cell;
        } else {
          return Array(Number(cell)).fill(null);
        }
      })
    );

  return (
    <div className="grid grid-cols-8 border-collapse gap-0.5">
      {state.map((row, i) =>
        row.map((cell, j) => (
          <div
            key={`${i}-${j}`}
            className={cn(
              "w-12 h-12 flex items-center justify-center",
              (i + j) % 2 === 0 ? "bg-gray-200" : "bg-gray-700"
            )}
          >
            {cell && <ChessPiece piece={cell} />}
          </div>
        ))
      )}
    </div>
  );
}
