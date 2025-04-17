import { useState, type Dispatch } from "react";

let count = 0;
let setCount: Dispatch<React.SetStateAction<number>> = () => {
  throw new Error("setCount is not defined");
};

export function App() {
  [count, setCount] = useState(0);

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <p>You clicked {count} times</p>
      <button className="btn" onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}

export function App2() {
  return (
    <div className="mt-4 flex flex-col items-center justify-center gap-4">
      <button className="btn" onClick={() => setCount(count + 1)}>
        Click me from App 2
      </button>
    </div>
  );
}
