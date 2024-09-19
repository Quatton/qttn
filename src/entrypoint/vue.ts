import type { App } from "vue";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import type { Environment } from "monaco-editor";

declare global {
  interface Window {
    MonacoEnvironment?: Environment | undefined;
  }
}

export default (app: App) => {
  app.use({
    install(app) {
      self.MonacoEnvironment = {
        getWorker(_, label) {
          return new editorWorker();
        },
      };
    },
  });
};
