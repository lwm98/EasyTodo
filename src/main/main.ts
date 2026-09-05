import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  net,
  protocol,
  screen,
  Tray,
} from 'electron';
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
const HANDLE_WIDTH = 8;
const HANDLE_HEIGHT = 52;

let panelWindow: BrowserWindow | null = null;
let handleWindow: BrowserWindow | null = null;
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
  handleWindow?.setBounds({
    x: workArea.x + workArea.width - HANDLE_WIDTH,
    y: workArea.y + Math.round((workArea.height - HANDLE_HEIGHT) / 2),
    width: HANDLE_WIDTH,
    height: HANDLE_HEIGHT,
  });
}

function rendererUrl(mode?: 'handle'): string {
  const developmentUrl = process.env.VITE_DEV_SERVER_URL;
  if (developmentUrl) return `${developmentUrl}${mode ? `?mode=${mode}` : ''}`;
  return path.join(__dirname, '../dist/renderer/index.html');
}

async function loadRenderer(window: BrowserWindow, mode?: 'handle'): Promise<void> {
  if (process.env.VITE_DEV_SERVER_URL) {
    await window.loadURL(rendererUrl(mode));
  } else {
    await window.loadFile(rendererUrl(), mode ? { query: { mode } } : undefined);
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
    resizable: false,
    maximizable: false,
    minimizable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#f7f7f5',
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
    transparent: true,
    resizable: false,
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
  panelWindow?.hide();
  positionWindows();
  handleWindow?.showInactive();
}

function createTray(): void {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="8" fill="#6258d6"/><path d="M9 16.5l4.2 4.2L23.5 10.5" fill="none" stroke="white" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const icon = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`).resize({ width: 16, height: 16 });
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
    if (typeof update.launchAtLogin === 'boolean') createTrayMenuRefresh();
    return { ok: true, settings };
  });
  ipcMain.on('panel:show-inactive', () => showPanel(false));
  ipcMain.on('panel:collapse', () => collapsePanel());
  ipcMain.on('panel:hide', () => collapsePanel());
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
