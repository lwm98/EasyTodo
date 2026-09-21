import {
  app,
  BrowserWindow,
  clipboard,
  ClipboardItem,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  net,
  protocol,
  screen,
  Tray,
} from 'electron';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { LocalStore } from './store';
import type { CreateTodoInput, Settings, UpdateTodoInput } from './types';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'easytodo-media',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);

const PANEL_WIDTH = 400;
const HANDLE_WIDTH = 24;
const HANDLE_HEIGHT = 68;

let panelWindow: BrowserWindow | null = null;
let handleWindow: BrowserWindow | null = null;
let imageWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let store: LocalStore;
let isQuitting = false;
let activeShortcut = '';

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

function rightmostDisplay() {
  return screen.getAllDisplays().reduce((rightmost, candidate) => {
    const edge = candidate.workArea.x + candidate.workArea.width;
    const rightmostEdge = rightmost.workArea.x + rightmost.workArea.width;
    return edge > rightmostEdge ? candidate : rightmost;
  });
}

function positionWindows(): void {
  const { workArea } = rightmostDisplay();
  panelWindow?.setBounds({
    x: workArea.x + workArea.width - PANEL_WIDTH,
    y: workArea.y,
    width: PANEL_WIDTH,
    height: workArea.height,
  });
  if (handleWindow) {
    // Windows can enforce a larger native minimum. Anchor using the actual size,
    // then clip both painting and mouse input to the small bookmark region.
    handleWindow.setSize(HANDLE_WIDTH, HANDLE_HEIGHT);
    const [width, height] = handleWindow.getSize();
    handleWindow.setBounds({ x: workArea.x + workArea.width - width,
      y: workArea.y + Math.round((workArea.height - height) / 2), width, height });
    if (process.platform === 'win32' || process.platform === 'linux') {
      handleWindow.setShape([{ x: width - HANDLE_WIDTH, y: Math.floor((height - HANDLE_HEIGHT) / 2),
        width: HANDLE_WIDTH, height: HANDLE_HEIGHT }]);
    }
  }
}

function rendererUrl(mode?: 'handle' | 'viewer', imageId?: string): string {
  const developmentUrl = process.env.VITE_DEV_SERVER_URL;
  if (developmentUrl) {
    const url = new URL(developmentUrl);
    if (mode) url.searchParams.set('mode', mode);
    if (imageId) url.searchParams.set('imageId', imageId);
    return url.toString();
  }
  return path.join(__dirname, '../dist/renderer/index.html');
}

async function loadRenderer(window: BrowserWindow, mode?: 'handle' | 'viewer', imageId?: string): Promise<void> {
  if (process.env.VITE_DEV_SERVER_URL) {
    await window.loadURL(rendererUrl(mode, imageId));
  } else {
    await window.loadFile(rendererUrl(), mode ? { query: { mode, ...(imageId ? { imageId } : {}) } } : undefined);
  }
}

function secureWindow(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
}

async function createWindows(): Promise<void> {
  const preload = path.join(__dirname, 'preload.js');
  panelWindow = new BrowserWindow({
    width: PANEL_WIDTH,
    height: 800,
    frame: false,
    thickFrame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    // CSS draws the rounded paper; the native window must not fill its corners.
    backgroundColor: '#00000000',
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  panelWindow.setAlwaysOnTop(true, 'floating');
  panelWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      collapsePanel();
    }
  });
  secureWindow(panelWindow);

  handleWindow = new BrowserWindow({
    width: HANDLE_WIDTH,
    height: HANDLE_HEIGHT,
    frame: false,
    thickFrame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    focusable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  handleWindow.setAlwaysOnTop(true, 'floating');
  secureWindow(handleWindow);

  positionWindows();
  await Promise.all([loadRenderer(panelWindow), loadRenderer(handleWindow, 'handle')]);
  handleWindow.showInactive();
}

function showPanel(focusInput: boolean): void {
  if (!panelWindow || !handleWindow) return;
  if (imageWindow) {
    imageWindow.focus();
    return;
  }
  positionWindows();
  handleWindow.hide();
  if (focusInput) {
    panelWindow.show();
    panelWindow.focus();
    panelWindow.webContents.send('panel:focus-composer');
  } else {
    panelWindow.showInactive();
  }
}

function collapsePanel(): void {
  if (imageWindow) return;
  panelWindow?.hide();
  positionWindows();
  handleWindow?.showInactive();
}

async function openImageViewer(imageId: string): Promise<void> {
  const todo = store.getTodos().find((item) => item.id === imageId && item.imageFile);
  if (!todo) return;
  if (imageWindow) {
    await loadRenderer(imageWindow, 'viewer', imageId);
    imageWindow.focus();
    return;
  }

  const { bounds } = screen.getDisplayMatching(panelWindow?.getBounds() ?? screen.getPrimaryDisplay().bounds);
  const viewer = new BrowserWindow({
    ...bounds,
    show: false,
    fullscreen: true,
    frame: false,
    backgroundColor: '#090909',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  imageWindow = viewer;
  secureWindow(viewer);
  viewer.on('closed', () => {
    imageWindow = null;
    if (!isQuitting) {
      showPanel(false);
      panelWindow?.focus();
    }
  });
  try {
    await loadRenderer(viewer, 'viewer', imageId);
    panelWindow?.hide();
    viewer.show();
    viewer.focus();
  } catch (error) {
    viewer.close();
    throw error;
  }
}

function showImageContextMenu(window: BrowserWindow, imageId: string): void {
  const todo = store.getTodos().find((item) => item.id === imageId && item.imageFile);
  if (!todo?.imageFile) return;
  const imagePath = path.join(store.imagesDirectory, path.basename(todo.imageFile));
  const mimeType = ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' } as Record<string, string>)[path.extname(imagePath).toLowerCase()];
  if (!mimeType) return;
  Menu.buildFromTemplate([{
    label: '复制图片',
    click: async () => {
      try {
        const bytes = await readFile(imagePath);
        await clipboard.write([new ClipboardItem({ [mimeType]: new Blob([new Uint8Array(bytes)], { type: mimeType }) })]);
      } catch (error) {
        console.error('无法复制图片', error);
      }
    },
  }]).popup({ window });
}

function createTray(): void {
  const icon = nativeImage.createFromPath(path.join(__dirname, '../assets/tray.png'));
  tray = new Tray(icon);
  tray.setToolTip('EasyTodo');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '打开面板', click: () => showPanel(true) },
      { type: 'separator' },
      {
        label: '开机启动',
        type: 'checkbox',
        checked: store.getSettings().launchAtLogin,
        click: async (item) => {
          app.setLoginItemSettings({ openAtLogin: item.checked });
          await store.updateSettings({ launchAtLogin: item.checked });
          createTrayMenuRefresh();
        },
      },
      {
        label: '设置',
        click: () => {
          showPanel(true);
          panelWindow?.webContents.send('panel:navigate', 'settings');
        },
      },
      { type: 'separator' },
      {
        label: '重新启动',
        click: () => {
          isQuitting = true;
          app.relaunch();
          app.quit();
        },
      },
      {
        label: '退出',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on('double-click', () => showPanel(true));
}

function createTrayMenuRefresh(): void {
  if (!tray) return;
  tray.destroy();
  tray = null;
  createTray();
}

function registerShortcut(shortcut: string): boolean {
  if (activeShortcut) globalShortcut.unregister(activeShortcut);
  try {
    const registered = globalShortcut.register(shortcut, () => showPanel(true));
    if (registered) activeShortcut = shortcut;
    return registered;
  } catch {
    return false;
  }
}

function registerIpc(): void {
  ipcMain.handle('state:get', () => ({
    todos: store.getTodos(),
    settings: store.getSettings(),
  }));
  ipcMain.handle('todo:create', (_event, input: CreateTodoInput) => store.createTodo(input));
  ipcMain.handle('todo:update', (_event, input: UpdateTodoInput) => store.updateTodo(input));
  ipcMain.handle('todo:archive', (_event, id: string) => store.archiveTodo(id));
  ipcMain.handle('todo:restore', (_event, id: string) => store.restoreTodo(id));
  ipcMain.handle('todo:delete', (_event, id: string) => store.deleteTodo(id));
  ipcMain.handle('settings:update', async (_event, update: Partial<Settings>) => {
    const previous = store.getSettings();
    if (update.shortcut && update.shortcut !== previous.shortcut) {
      if (!registerShortcut(update.shortcut)) {
        registerShortcut(previous.shortcut);
        return { ok: false, error: '快捷键已被其他程序占用或格式无效', settings: previous };
      }
    }
    if (typeof update.launchAtLogin === 'boolean') {
      app.setLoginItemSettings({ openAtLogin: update.launchAtLogin });
    }
    const settings = await store.updateSettings(update);
    handleWindow?.webContents.send('settings:changed', settings);
    if (typeof update.launchAtLogin === 'boolean') createTrayMenuRefresh();
    return { ok: true, settings };
  });
  ipcMain.on('panel:show-inactive', () => showPanel(false));
  ipcMain.on('panel:collapse', () => collapsePanel());
  ipcMain.on('panel:hide', () => collapsePanel());
  ipcMain.handle('image:open', (_event, imageId: string) => openImageViewer(imageId));
  ipcMain.on('image:close', () => imageWindow?.close());
  ipcMain.on('image:context-menu', (event, imageId: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) showImageContextMenu(window, imageId);
  });
}

app.on('second-instance', () => showPanel(true));

app.whenReady().then(async () => {
  store = new LocalStore(app.getPath('userData'));
  await store.initialize();

  protocol.handle('easytodo-media', (request) => {
    const url = new URL(request.url);
    const filename = path.basename(decodeURIComponent(url.pathname.slice(1)));
    return net.fetch(pathToFileURL(path.join(store.imagesDirectory, filename)).toString());
  });

  registerIpc();
  await createWindows();
  createTray();
  registerShortcut(store.getSettings().shortcut);

  screen.on('display-added', positionWindows);
  screen.on('display-removed', positionWindows);
  screen.on('display-metrics-changed', positionWindows);
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {
  // EasyTodo intentionally remains available from the tray on Windows.
});
