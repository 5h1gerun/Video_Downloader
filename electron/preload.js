const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dlExeApi", {
  selectOutputDirectory: () => ipcRenderer.invoke("select-output-directory"),
  runDownload: (params) => ipcRenderer.invoke("run-download", params),
  updateYtDlp: () => ipcRenderer.invoke("update-yt-dlp"),
  onTaskLog: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("task-log", listener);
    return () => ipcRenderer.removeListener("task-log", listener);
  }
});

