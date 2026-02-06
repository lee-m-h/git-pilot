const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

let mainWindow;
let serverProcess;

const isDev = !app.isPackaged;
const PORT = 4003;

// 창 상태 저장 경로
const stateFile = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    if (fs.existsSync(stateFile)) {
      return JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load window state:', e);
  }
  return { width: 1400, height: 900 };
}

function saveWindowState() {
  if (!mainWindow) return;
  try {
    const bounds = mainWindow.getBounds();
    const state = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: mainWindow.isMaximized(),
    };
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Failed to save window state:', e);
  }
}

function getServerPath() {
  if (isDev) return null;
  return path.join(process.resourcesPath, 'app', 'server.js');
}

function createMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Add Repository',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript('document.querySelector("button[title=\\"Add Repository\\"]")?.click()');
            }
          }
        },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'GitHub Repository',
          click: () => shell.openExternal('https://github.com/lee-m-h/git-pilot')
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 1000,
    minHeight: 600,
    title: 'Git Pilot',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#0a0a0a',
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (state.isMaximized) {
    mainWindow.maximize();
  }

  const url = `http://localhost:${PORT}`;

  waitForServer(url, 30000)
    .then(() => mainWindow.loadURL(url))
    .catch((err) => {
      console.error('Server connection failed:', err);
      mainWindow.loadURL(`data:text/html;charset=utf-8,
        <html>
          <body style="background:#0a0a0a;color:#fff;font-family:system-ui;padding:40px;text-align:center;">
            <h1 style="color:#ef4444;">⚠️ Failed to start Git Pilot</h1>
            <p style="color:#888;">Server could not be started. Please try again.</p>
            <pre style="background:#1a1a1a;padding:20px;border-radius:8px;text-align:left;overflow:auto;">${err.message}</pre>
            <button onclick="location.reload()" style="margin-top:20px;padding:10px 20px;background:#3b82f6;color:#fff;border:none;border-radius:8px;cursor:pointer;">
              Retry
            </button>
          </body>
        </html>
      `);
    });

  // 창 상태 저장
  mainWindow.on('close', saveWindowState);
  mainWindow.on('closed', () => { mainWindow = null; });

  // 외부 링크는 기본 브라우저에서 열기
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

function waitForServer(url, timeout) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, () => resolve());

      req.on('error', () => {
        if (Date.now() - start > timeout) {
          reject(new Error('Server startup timeout'));
        } else {
          setTimeout(check, 200);
        }
      });

      req.setTimeout(1000, () => {
        req.destroy();
        if (Date.now() - start > timeout) {
          reject(new Error('Server startup timeout'));
        } else {
          setTimeout(check, 200);
        }
      });
    };

    check();
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    if (isDev) {
      console.log('Dev mode - expecting server at localhost:' + PORT);
      resolve();
      return;
    }

    const serverPath = getServerPath();
    console.log('Starting server:', serverPath);

    if (!serverPath) {
      reject(new Error('Server path not found'));
      return;
    }

    const env = {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'production',
      HOSTNAME: 'localhost',
    };

    const nodePath = process.execPath.includes('Electron')
      ? '/usr/local/bin/node'
      : process.execPath;

    serverProcess = spawn(nodePath, [serverPath], {
      env,
      cwd: path.dirname(serverPath),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProcess.stdout.on('data', (data) => {
      console.log(`[Server] ${data.toString().trim()}`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[Server Error] ${data.toString().trim()}`);
    });

    serverProcess.on('error', reject);
    serverProcess.on('exit', (code) => console.log('Server exited:', code));

    setTimeout(resolve, 1000);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

// App lifecycle
app.whenReady().then(async () => {
  createMenu();
  
  try {
    await startServer();
    createWindow();
  } catch (err) {
    console.error('Failed to start:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', stopServer);
app.on('will-quit', stopServer);
