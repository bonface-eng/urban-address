const { app, BrowserWindow, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

let mainWindow;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 768,
    title: "URBAN EXPRESS | Business OS",
    autoHideMenuBar: true, // Professional app feel, hides browser-like menus
    icon: path.join(__dirname, '../../public/assets/logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#ffffff',
    show: false,
  });

  // Load the application
  const startUrl = isDev 
    ? 'http://localhost:9002' 
    : 'https://studio-4371382043-96293.web.app'; // Points to the deployed webapp for consistency

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // System Menu
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Kiosk Mode', type: 'checkbox', checked: false, click: (item) => mainWindow.setKiosk(item.checked) },
        { type: 'separator' },
        { label: 'Exit', role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forcereload' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();

  // Create Tray Icon
  const icon = nativeImage.createFromPath(path.join(__dirname, '../../public/assets/logo.png'));
  if (icon) {
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Open Urban Express', click: () => mainWindow.show() },
      { label: 'Toggle Kiosk Mode', type: 'checkbox', click: (item) => mainWindow.setKiosk(item.checked) },
      { type: 'separator' },
      { label: 'Terminate App', role: 'quit' }
    ]);
    tray.setToolTip('Urban Business OS');
    tray.setContextMenu(contextMenu);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
