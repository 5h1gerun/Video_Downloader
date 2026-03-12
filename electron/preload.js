const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dlExeApi", {
  selectOutputDirectory: () => ipcRenderer.invoke("select-output-directory"),
  runDownload: (params) => ipcRenderer.invoke("run-download", params),
  openPath: (targetPath) => ipcRenderer.invoke("open-path", targetPath),
  onTaskLog: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("task-log", listener);
    return () => ipcRenderer.removeListener("task-log", listener);
  }
});
