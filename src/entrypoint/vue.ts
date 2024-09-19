import type { App } from "vue";
import * as monaco from "monaco-editor";

export default (app: App) => {
  const getWorkerModule = (moduleUrl: string, label: string) => {
    if (!self.MonacoEnvironment?.getWorkerUrl)
      throw new Error("MonacoEnvironment.getWorkerUrl is not defined");

    return new Worker(self.MonacoEnvironment.getWorkerUrl(moduleUrl, label), {
      name: label,
      type: "module",
    });
  };

  self.MonacoEnvironment = {
    getWorker(workerId, label) {
      return getWorkerModule(
        "/monaco-editor/esm/vs/editor/editor.worker?worker",
        label,
      );
    },
  };
};
