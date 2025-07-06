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
      <p>You clicked {count} times</p>
      <button
        className="btn"
        onClick={() => {
          setCount(count + 1);
        }}
      >
        Click me from App 2
      </button>
    </div>
  );
}

let count2 = 0;
let setCount2: Dispatch<React.SetStateAction<number>> = () => {
  throw new Error("setCount is not defined");
};

export function App3() {
  [count2, setCount2] = useState(0);

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <p>You clicked {count2} times</p>
      <button className="btn" onClick={() => setCount2(count2 + 1)}>
        Click me
      </button>
    </div>
  );
}

export function App4() {
  const [_, setRerender] = useState(false);

  function rerender() {
    setRerender((prev) => !prev);
  }

  return (
    <div className="mt-4 flex flex-col items-center justify-center gap-4">
      <p>You clicked {count2} times</p>
      <button
        className="btn"
        onClick={() => {
          setCount2(count2 + 1);
          rerender();
        }}
      >
        Click me from App 2
      </button>
    </div>
  );
}

const useCounter = (() => {
  let state = 0;
  const setters = new Set<Dispatch<React.SetStateAction<number>>>();

  function setState(newState: React.SetStateAction<number>) {
    if (typeof newState === "function") {
      state = (newState as Function)(state);
    } else {
      state = newState;
    }
    setters.forEach((setter) => setter(state));
  }

  return () => {
    const [localState, setLocalState] = useState(state);

    setters.add(setLocalState);

    return [localState, setState] as const;
  };
})();

export function Iife1() {
  const [count, setCount] = useCounter();

  return (
    <div className="mt-4 flex flex-col items-center justify-center gap-4">
      <p>You clicked {count} times</p>
      <button className="btn" onClick={() => setCount(count + 1)}>
        Click me from IIFE 1
      </button>
    </div>
  );
}

export function Iife2() {
  const [count, setCount] = useCounter();

  return (
    <div className="mt-4 flex flex-col items-center justify-center gap-4">
      <p>You clicked {count} times</p>
      <button className="btn" onClick={() => setCount(count + 1)}>
        Click me from IIFE 2
      </button>
    </div>
  );
}
