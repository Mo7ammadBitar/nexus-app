/**
 * preload.js – Secure bridge between renderer and main process.
 * Exposes a minimal API via contextBridge.
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getBackendUrl: () => ipcRenderer.invoke("get-backend-url"),
  getTheme:      () => ipcRenderer.invoke("get-theme"),
  setTheme:      (t) => ipcRenderer.invoke("set-theme", t),
});
