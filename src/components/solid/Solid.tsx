import { increment, test } from "../blog/using-vue/hooks";

export function SolidComponent() {
  return (
    <div class="flex items-center justify-center gap-4">
      <button class="btn" onClick={increment}>
        Increment
      </button>
      <p class="bg-base-200 grid h-12 w-12 place-content-center rounded-sm">
        {test()}
      </p>
    </div>
  );
}
