const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let serverProcess;

const isDev = !app.isPackaged;
const PORT = 4003;

function getServerPath() {
  if (isDev) {
    return null; // Dev mode uses external server
  }
  
  // Production: server.js is in resources/app
  const resourcesPath = process.resourcesPath;
  return path.join(resourcesPath, 'app', 'server.js');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: 'Git Pilot',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const url = `http://localhost:${PORT}`;
  
  waitForServer(url, 30000)
    .then(() => {
      mainWindow.loadURL(url);
    })
    .catch((err) => {
      console.error('Server connection failed:', err);
      mainWindow.loadURL(`data:text/html;charset=utf-8,
        <html>
          <body style="background:#0a0a0a;color:#fff;font-family:system-ui;padding:40px;">
            <h1>⚠️ Failed to start Git Pilot</h1>
            <p>Server could not be started. Please try again.</p>
            <pre style="background:#1a1a1a;padding:20px;border-radius:8px;">${err.message}</pre>
          </body>
        </html>
      `);
    });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function waitForServer(url, timeout) {
  const start = Date.now();
  
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        resolve();
      });
      
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

    // Find node executable
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

    serverProcess.on('error', (err) => {
      console.error('Server process error:', err);
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      console.log('Server exited with code:', code);
    });

    // Give server time to start
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
  try {
    await startServer();
    createWindow();
  } catch (err) {
    console.error('Failed to start:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', stopServer);
app.on('will-quit', stopServer);
