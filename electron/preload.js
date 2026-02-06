const { contextBridge, ipcRenderer } = require('electron');

// Electron API 노출
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  isElectron: true,
  
  // 앱 버전
  getVersion: () => require('../package.json').version,
  
  // 창 컨트롤
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
});
