import { useState } from "react";

interface Props {
  page: number;
}

export default function BookmarkButton({ page }: Props) {
  const [copied, setCopied] = useState(false);

  function handleClick() {
    const url = `${location.origin}${location.pathname}#page${page}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      className="not-prose btn absolute top-4 left-4 z-20 btn-square"
      title="Copy page URL"
      onClick={handleClick}
    >
      <span className="sr-only">Copy page URL</span>
      {copied ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          className="size-6"
        >
          <path
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M20 6L9 17l-5-5"
          />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          className="size-6"
        >
          <path
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z"
          />
        </svg>
      )}
    </button>
  );
}
