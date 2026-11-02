const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld(
  'bardforge',
  Object.freeze({
    status: () => ipcRenderer.invoke('desktop:status'),
    saveSceneArchive: (bytes, name) => ipcRenderer.invoke('desktop:export-scene', bytes, name),
    checkUpdates: () => ipcRenderer.invoke('desktop:check-updates'),
    installUpdate: () => ipcRenderer.invoke('desktop:install-update'),
    installComponent: (id) => ipcRenderer.invoke('desktop:install-component', id),
    cancelComponent: (id) => ipcRenderer.invoke('desktop:cancel-component', id),
  }),
);
