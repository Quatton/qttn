import type { App } from "vue";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import type { Environment } from "monaco-editor";

declare global {
  interface Window {
    MonacoEnvironment?: Environment | undefined;
  }
}

export default (_app: App) => {
  if (typeof self === "undefined") {
    return;
  }
  self.MonacoEnvironment = {
    getWorker(_, __) {
      return new editorWorker();
    },
  };
};
