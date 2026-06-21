const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let isQuitting = false;

// 数据文件路径
const dataPath = path.join(app.getPath('userData'), 'data.json');

// 默认数据
const defaultData = {
  todos: [],
  settings: {
    autoLaunch: false,
    categories: ['工作', '生活', '学习', '其他']
  }
};

// 读取数据
function loadData() {
  try {
    if (fs.existsSync(dataPath)) {
      const raw = fs.readFileSync(dataPath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('读取数据失败:', e);
  }
  return { ...defaultData };
}

// 保存数据
function saveData(data) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('保存数据失败:', e);
    return false;
  }
}

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 关闭时最小化到托盘
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 创建系统托盘
function createTray() {
  // 使用简单图标（实际项目中应替换为真实图标）
  tray = new Tray(path.join(__dirname, 'assets', 'icon.png'));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('待办提醒');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// 设置开机自启
function setAutoLaunch(enable) {
  app.setLoginItemSettings({
    openAtLogin: enable,
    path: app.getPath('exe')
  });
}

// 检查提醒
function checkReminders() {
  const data = loadData();
  const now = new Date();
  let updated = false;

  data.todos.forEach(todo => {
    if (todo.completed || todo.notified) return;

    const remindTime = new Date(todo.remindAt);
    if (remindTime <= now) {
      // 触发通知
      if (mainWindow) {
        mainWindow.webContents.send('trigger-notification', {
          id: todo.id,
          title: todo.title,
          body: todo.description || '待办事项提醒'
        });
      }

      // 处理重复提醒
      if (todo.repeat && todo.repeat !== 'none') {
        const nextTime = calculateNextRemindTime(remindTime, todo.repeat);
        todo.remindAt = nextTime.toISOString();
        todo.notified = false;
      } else {
        todo.notified = true;
      }
      updated = true;
    }
  });

  if (updated) {
    saveData(data);
  }
}

// 计算下次提醒时间
function calculateNextRemindTime(currentTime, repeatType) {
  const next = new Date(currentTime);

  switch (repeatType) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
  }

  return next;
}

// IPC 处理器
ipcMain.handle('load-data', () => {
  return loadData();
});

ipcMain.handle('save-data', (event, data) => {
  return saveData(data);
});

ipcMain.handle('export-data', async (event, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出待办数据',
    defaultPath: 'todo-backup.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });

  if (!result.canceled && result.filePath) {
    try {
      fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
      return { success: true, path: result.filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: false, error: '已取消' };
});

ipcMain.handle('import-data', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入待办数据',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
      const data = JSON.parse(raw);
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: false, error: '已取消' };
});

ipcMain.handle('set-auto-launch', (event, enable) => {
  setAutoLaunch(enable);
  const data = loadData();
  data.settings.autoLaunch = enable;
  saveData(data);
  return true;
});

// 应用就绪
app.whenReady().then(() => {
  createWindow();
  createTray();

  // 每分钟检查提醒
  setInterval(checkReminders, 60 * 1000);
  // 启动时立即检查一次
  checkReminders();
});

// 所有窗口关闭
app.on('window-all-closed', () => {
  // 不退出，保持托盘运行
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});
