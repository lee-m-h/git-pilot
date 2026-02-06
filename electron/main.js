const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const http = require('http');
const https = require('https');
const fs = require('fs');

let mainWindow;
let serverProcess;
let isStartingUp = false;

const isDev = !app.isPackaged;
const PORT = 4003;

// GitHub 레포 정보
const GITHUB_OWNER = 'lee-m-h';
const GITHUB_REPO = 'git-pilot';

// 단일 인스턴스 잠금
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

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

// 버전 비교 함수
function compareVersions(v1, v2) {
  const parts1 = v1.replace(/^v/, '').split('.').map(Number);
  const parts2 = v2.replace(/^v/, '').split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

// GitHub에서 최신 릴리즈 확인
function checkForUpdates() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      headers: {
        'User-Agent': 'Git-Pilot-App',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const release = JSON.parse(data);
            resolve({
              version: release.tag_name,
              url: release.html_url,
              notes: release.body,
              downloadUrl: release.assets?.find(a => a.name.endsWith('.dmg'))?.browser_download_url
            });
          } else {
            resolve(null); // 릴리즈 없음
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// 업데이트 확인 및 알림
async function checkAndNotifyUpdate() {
  try {
    const currentVersion = app.getVersion();
    const latest = await checkForUpdates();
    
    if (!latest) {
      console.log('No releases found');
      return;
    }

    console.log(`Current: ${currentVersion}, Latest: ${latest.version}`);
    
    if (compareVersions(latest.version, currentVersion) > 0) {
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '업데이트 알림',
        message: `새 버전이 있습니다!`,
        detail: `현재 버전: v${currentVersion}\n최신 버전: ${latest.version}\n\n업데이트 하시겠습니까?`,
        buttons: ['업데이트', '나중에'],
        defaultId: 0,
        cancelId: 1
      });

      if (result.response === 0) {
        // 다운로드 페이지 열기
        const url = latest.downloadUrl || latest.url;
        shell.openExternal(url);
      }
    }
  } catch (err) {
    console.error('Update check failed:', err.message);
  }
}

function findNodePath() {
  const candidates = [
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    '/usr/bin/node',
  ];
  
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (e) {}
  }
  
  try {
    const nodePath = execSync('which node', { encoding: 'utf-8' }).trim();
    if (nodePath && fs.existsSync(nodePath)) {
      return nodePath;
    }
  } catch (e) {}
  
  return null;
}

function getServerPath() {
  if (isDev) return null;
  const serverPath = path.join(process.resourcesPath, 'app', 'server.js');
  return serverPath;
}

function createMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: '업데이트 확인...',
          click: () => checkAndNotifyUpdate()
        },
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
          click: () => shell.openExternal(`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`)
        },
        {
          label: 'Release Notes',
          click: () => shell.openExternal(`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`)
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  if (mainWindow) {
    mainWindow.focus();
    return;
  }

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
    show: false,
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

  // 로딩 화면
  mainWindow.loadURL(`data:text/html;charset=utf-8,
    <html>
      <body style="background:#0a0a0a;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="text-align:center;">
          <div style="font-size:48px;margin-bottom:20px;">🚀</div>
          <h2 style="margin:0;font-weight:500;">Starting Git Pilot...</h2>
          <p style="color:#666;margin-top:10px;">v${app.getVersion()}</p>
        </div>
      </body>
    </html>
  `);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', saveWindowState);
  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  return mainWindow;
}

function waitForServer(url, timeout) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode === 200 || res.statusCode === 304) {
          resolve();
        } else {
          retry();
        }
      });

      req.on('error', retry);
      req.setTimeout(1000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - start > timeout) {
        reject(new Error(`Server startup timeout after ${timeout}ms`));
      } else {
        setTimeout(check, 300);
      }
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
    
    if (!serverPath || !fs.existsSync(serverPath)) {
      reject(new Error(`Server not found at: ${serverPath}`));
      return;
    }

    const nodePath = findNodePath();
    if (!nodePath) {
      reject(new Error('Node.js not found. Please install Node.js.'));
      return;
    }

    console.log('Starting server with node:', nodePath);
    console.log('Server path:', serverPath);

    const env = {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'production',
      HOSTNAME: 'localhost',
    };

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

    serverProcess.on('error', (err) => {
      console.error('Server process error:', err);
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      console.log('Server exited with code:', code);
    });

    setTimeout(resolve, 1000);
  });
}

function stopServer() {
  if (serverProcess) {
    console.log('Stopping server...');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

async function loadApp() {
  const url = `http://localhost:${PORT}`;
  
  try {
    await waitForServer(url, 30000);
    if (mainWindow) {
      mainWindow.loadURL(url);
      
      // 앱 로드 완료 후 업데이트 체크 (3초 후)
      setTimeout(() => {
        checkAndNotifyUpdate();
      }, 3000);
    }
  } catch (err) {
    console.error('Server connection failed:', err);
    if (mainWindow) {
      mainWindow.loadURL(`data:text/html;charset=utf-8,
        <html>
          <body style="background:#0a0a0a;color:#fff;font-family:system-ui;padding:40px;text-align:center;">
            <h1 style="color:#ef4444;">⚠️ Failed to start Git Pilot</h1>
            <p style="color:#888;">Server could not be started.</p>
            <pre style="background:#1a1a1a;padding:20px;border-radius:8px;text-align:left;overflow:auto;max-width:600px;margin:20px auto;">${err.message}</pre>
          </body>
        </html>
      `);
    }
  }
}

// App lifecycle
app.whenReady().then(async () => {
  if (isStartingUp) return;
  isStartingUp = true;
  
  createMenu();
  createWindow();
  
  try {
    await startServer();
    await loadApp();
  } catch (err) {
    console.error('Failed to start:', err);
    if (mainWindow) {
      mainWindow.loadURL(`data:text/html;charset=utf-8,
        <html>
          <body style="background:#0a0a0a;color:#fff;font-family:system-ui;padding:40px;text-align:center;">
            <h1 style="color:#ef4444;">⚠️ Startup Error</h1>
            <pre style="background:#1a1a1a;padding:20px;border-radius:8px;">${err.message}</pre>
          </body>
        </html>
      `);
    }
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    loadApp();
  }
});

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', stopServer);
app.on('will-quit', stopServer);
