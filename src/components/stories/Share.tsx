import html2canvas from "html2canvas-pro";
import { useEffect, useState } from "react";

interface Props {
  documentId: string;
}

type Status = "idle" | "sharing" | "shared" | "error";

export function Share({ documentId }: Props) {
  const [status, setStatus] = useState<Status>("idle");

  async function handleClick() {
    if (!navigator.share || status === "sharing") return;

    const document = window.document.getElementById(documentId);
    if (!document) {
      setStatus("error");
      return;
    }

    setStatus("sharing");

    try {
      const canvas = await html2canvas(document, {
        logging: false,
        onclone: (clonedDocument) => {
          clonedDocument
            .querySelectorAll(".screenshot-hidden")
            .forEach((element) => {
              if (element instanceof HTMLElement)
                element.style.display = "none";
            });
        },
        useCORS: true
      });
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => {
          if (value) resolve(value);
          else reject(new Error("Could not create a share image."));
        }, "image/png");
      });
      const url = new URL(location.href);
      url.hash = documentId;
      const file = new File([blob], `${documentId}.png`, {
        type: "image/png"
      });
      const shareData = {
        title: document.title,
        text: document.title,
        url: url.toString(),
        files: [file]
      };

      await navigator.share(
        navigator.canShare?.({ files: shareData.files })
          ? shareData
          : { title: shareData.title, text: shareData.text, url: shareData.url }
      );
      setStatus("shared");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("idle");
      } else {
        setStatus("error");
      }
    }
  }

  useEffect(() => {
    if (status === "shared" || status === "error") {
      const timeout = setTimeout(() => setStatus("idle"), 2000);
      return () => clearTimeout(timeout);
    }
  }, [status]);

  const label =
    status === "sharing"
      ? "Preparing share"
      : status === "shared"
        ? "Page shared"
        : status === "error"
          ? "Unable to share page"
          : "Share page";

  return (
    <button
      className="screenshot-hidden not-prose btn absolute top-4 left-16 z-20 btn-square"
      title={label}
      aria-label={label}
      disabled={status === "sharing"}
      onClick={handleClick}
    >
      {status === "sharing" ? (
        <span className="loading size-5 loading-spinner" />
      ) : status === "shared" ? (
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
            d="m5 12l4 4L19 6"
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
            d="M12 16V4m0 0L8 8m4-4l4 4M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"
          />
        </svg>
      )}
    </button>
  );
}
