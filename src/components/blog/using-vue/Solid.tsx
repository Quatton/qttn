import { increment, test } from "./hooks";

export function SolidComponent() {
  return (
    <div class="flex items-center justify-center gap-4">
      <button class="btn" onClick={increment}>
        Increment
      </button>
      <p class="grid h-12 w-12 place-content-center rounded bg-base-200">
        {test()}
      </p>
    </div>
  );
}
