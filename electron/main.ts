import { app, BrowserWindow, nativeTheme, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { initDatabase } from './db';
import { syncAllMcpServers, disconnectAllMcpServers } from './mcp';
import { registerIpcHandlers } from './ipcHandlers';
import { clearIncognitoStore } from './services/chatStore';

let mainWindow: BrowserWindow | null = null;

app.setName('Synapse');
app.setPath('userData', path.join(app.getPath('appData'), 'space.zemskov.synapse'));

function resolveAppIconPath(): string | undefined {
  const relSubpath =
    process.platform === 'win32'
      ? path.join('assets', 'icons', 'windows', 'icon.ico')
      : process.platform === 'linux'
        ? path.join('assets', 'icons', 'linux', 'icons', '512x512.png')
        : path.join('assets', 'icons', 'macos', '512x512.png');

  const candidates = [
    path.join(__dirname, '..', relSubpath),
    path.join(process.cwd(), relSubpath),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function createWindow(): void {
  const preloadMjs = path.join(__dirname, 'preload.mjs');
  const preloadJs = path.join(__dirname, 'preload.js');
  const preloadPath = fs.existsSync(preloadMjs) ? preloadMjs : preloadJs;
  const iconPath = resolveAppIconPath();

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 940,
    minHeight: 620,
    title: 'Synapse by zemskov.space',
    ...(iconPath ? { icon: iconPath } : {}),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send('theme:system-changed', nativeTheme.shouldUseDarkColors);
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Intercept any target="_blank" or window.open links and open them in the user's default OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Intercept any direct in-window navigation away from the app and open external URLs in the default OS browser
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env.VITE_DEV_SERVER_URL || '';
    const isInternalDev = devUrl && url.startsWith(devUrl);
    const isInternalFile = url.startsWith('file://');
    if (!isInternalDev && !isInternalFile) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) {
        shell.openExternal(url);
      }
    }
  });
}

app.whenReady().then(async () => {
  if (process.platform === 'darwin' && app.dock) {
    const iconPath = resolveAppIconPath();
    if (iconPath) {
      app.dock.setIcon(iconPath);
    }
  }

  await initDatabase();
  registerIpcHandlers();
  createWindow();

  // Connect enabled MCP servers in background
  syncAllMcpServers().catch((err) => console.error('MCP sync error:', err));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  disconnectAllMcpServers();
  clearIncognitoStore();
});

app.on('window-all-closed', () => {
  clearIncognitoStore();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
