const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    updateBadgeCount: (count, dataUrl) => ipcRenderer.send('update-badge-count', count, dataUrl),
});
