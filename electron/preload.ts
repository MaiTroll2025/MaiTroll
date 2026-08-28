import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('app-version'),
  getAppPath: () => ipcRenderer.invoke('app-path'),
  checkForUpdate: () => ipcRenderer.invoke('app-update-check'),
  downloadUpdate: () => ipcRenderer.invoke('app-update-download'),
  installUpdate: () => ipcRenderer.invoke('app-update-install'),
  cancelUpdate: () => ipcRenderer.invoke('app-update-cancel'),
  onAppUpdate: (callback: (payload: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload)
    ipcRenderer.on('app-update', listener)
    return () => ipcRenderer.removeListener('app-update', listener)
  },
  onDeepLink: (callback: (url: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, url: string) => callback(url)
    ipcRenderer.on('deep-link', listener)
    return () => ipcRenderer.removeListener('deep-link', listener)
  },
  isElectron: true,
})
