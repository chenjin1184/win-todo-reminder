const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 数据操作
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),

  // 导入导出
  exportData: (data) => ipcRenderer.invoke('export-data', data),
  importData: () => ipcRenderer.invoke('import-data'),

  // 设置
  setAutoLaunch: (enable) => ipcRenderer.invoke('set-auto-launch', enable),

  // 通知触发（主进程 → 渲染进程）
  onTriggerNotification: (callback) => {
    ipcRenderer.on('trigger-notification', (event, data) => callback(data));
  }
});
