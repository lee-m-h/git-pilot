const { contextBridge, ipcRenderer } = require('electron');

// Expose any electron APIs if needed
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
});
