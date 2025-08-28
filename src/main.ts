import { app, BrowserWindow, Menu, dialog } from 'electron';

// Build info injected at compile time
declare const __BUILD_INFO__: {
  version: string;
  commitHash: string;
  commitDate: string;
  branch: string;
  buildDate: string;
  buildId: string;
};
import path from 'node:path';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools in development only
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Set up application menu
  createMenu();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

const createMenu = () => {
  const template = [
    {
      label: app.getName(),
      submenu: [
        {
          label: `About ${app.getName()}`,
          click: showAboutDialog
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template as any);
  Menu.setApplicationMenu(menu);
};

const showAboutDialog = () => {
  const detailText = [
    `Version: ${__BUILD_INFO__.version}`,
    `Commit: ${__BUILD_INFO__.commitHash.substring(0, 8)}`,
    `Branch: ${__BUILD_INFO__.branch}`,
    `Build Date: ${new Date(__BUILD_INFO__.buildDate).toLocaleString()}`,
    '',
    `Platform: ${process.platform} (${process.arch})`,
    `Electron: ${process.versions.electron}`,
    `Chrome: ${process.versions.chrome}`,
    `Node.js: ${process.versions.node}`
  ].join('\n');

  dialog.showMessageBox({
    type: 'info',
    title: `About ${app.getName()}`,
    message: app.getName(),
    detail: detailText,
    buttons: ['OK']
  });
};

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
