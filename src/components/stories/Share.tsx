import html2canvas from "html2canvas-pro";
import { useEffect, useRef, useState } from "react";

interface Props {
  documentId: string;
}

type Status = "idle" | "sharing" | "shared" | "copied" | "downloaded" | "error";

export function Share({ documentId }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const dialogRef = useRef<HTMLDialogElement>(null);

  function getPageUrl() {
    const url = new URL(location.href);
    url.hash = documentId;
    return url.toString();
  }

  async function copyPageLink() {
    try {
      await navigator.clipboard.writeText(getPageUrl());
      setStatus("copied");
      setTimeout(() => dialogRef.current?.close(), 1200);
    } catch {
      setStatus("error");
    }
  }

  async function downloadScreenshot() {
    const target = window.document.getElementById(documentId);
    if (!target) {
      setStatus("error");
      return;
    }

    setStatus("sharing");
    try {
      const canvas = await html2canvas(target, {
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
      const downloadUrl = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = downloadUrl;
      const title = target.querySelector("h1")?.textContent?.trim() || document.title;
      const filename = title
        .replace(/[<>:"/\\|?*]/g, "")
        .replace(/\p{Cc}/gu, "")
        .replace(/\s+/g, " ")
        .replace(/[. ]+$/, "");
      link.download = `${filename || "Screenshot"}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      await navigator.clipboard.writeText(getPageUrl());
      setStatus("downloaded");
      setTimeout(() => dialogRef.current?.close(), 1200);
    } catch {
      setStatus("error");
    }
  }

  async function handleClick() {
    if (status === "sharing") return;
    if (!navigator.share) {
      dialogRef.current?.showModal();
      return;
    }

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

      if (
        navigator.share &&
        (!navigator.canShare || navigator.canShare({ files: shareData.files }))
      ) {
        await navigator.share(shareData);
        setStatus("shared");
      } else if (navigator.share) {
        await navigator.share({
          title: shareData.title,
          text: shareData.text,
          url: shareData.url
        });
        setStatus("shared");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("idle");
      } else {
        setStatus("error");
      }
    }
  }

  useEffect(() => {
    if (
      status === "shared" ||
      status === "copied" ||
      status === "downloaded" ||
      status === "error"
    ) {
      const timeout = setTimeout(() => setStatus("idle"), 2000);
      return () => clearTimeout(timeout);
    }
  }, [status]);

  const label =
    status === "sharing"
      ? "Preparing share"
      : status === "shared"
        ? "Page shared"
        : status === "copied"
          ? "Link copied"
          : status === "downloaded"
            ? "Screenshot downloaded; link copied"
            : status === "error"
              ? "Unable to share page"
              : "Share page";

  const checkIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      className="size-5"
      aria-hidden="true"
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
  );

  return (
    <>
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
      <dialog ref={dialogRef} className="modal">
        <div className="modal-box">
          <h2 className="text-lg font-bold">Sharing isn’t available here</h2>
          <p className="py-4">
            You can copy a link to this page, or download a screenshot and copy
            the link.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              className="btn"
              onClick={copyPageLink}
              disabled={status === "sharing"}
            >
              {status === "copied" ? (
                <>
                  {checkIcon} Link copied
                </>
              ) : (
                "Copy link"
              )}
            </button>
            <button
              className="btn btn-primary"
              onClick={downloadScreenshot}
              disabled={status === "sharing"}
            >
              {status === "sharing" ? (
                <span className="loading size-5 loading-spinner" />
              ) : status === "downloaded" ? (
                <>
                  {checkIcon} Screenshot downloaded; link copied
                </>
              ) : (
                "Download screenshot + copy link"
              )}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label="Close dialog">close</button>
        </form>
      </dialog>
    </>
  );
}
