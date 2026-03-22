const { app, BrowserWindow, session } = require('electron');
const path = require('path');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('moodplayer', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('moodplayer');
}

app.on('second-instance', (event, commandLine, workingDirectory) => {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// macOS deep link handler
app.on('open-url', (event, url) => {
  event.preventDefault();
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function createWindow () {
  const win = new BrowserWindow({
    width: 600,
    height: 500,
    transparent: true,
    frame: false,
    resizable: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadURL('http://localhost:8080', { extraHeaders: 'pragma: no-cache\n' });
  
  win.setAlwaysOnTop(true, 'floating');

  win.webContents.on('did-finish-load', () => {
    win.webContents.insertCSS(`
      .sky { background: transparent !important; }
      .moon, .clouds, .stars { display: none !important; }
      
      .cassette-front, .cassette-back { 
          -webkit-app-region: drag; 
      }
      
      .label-area, .cassette-bottom, .screw { 
          -webkit-app-region: no-drag; 
      }
      input, button, li {
          -webkit-app-region: no-drag;
          -webkit-user-select: text;
      }
      
      body, html { margin: 0; padding: 0; background: transparent; }
    `);
  });
}

app.whenReady().then(() => {
  session.defaultSession.clearCache().then(() => {
    createWindow();
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
