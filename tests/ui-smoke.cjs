// Exercise the real packaged renderer and IPC using a separate, disposable profile.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

if (!process.versions.electron) {
  const { spawnSync } = require('node:child_process');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.VITE_DEV_SERVER_URL;
  const result = spawnSync(require('electron'), [__filename], { env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
} else {
  const { app, BrowserWindow, nativeImage, nativeTheme, screen } = require('electron');
  const profile = fs.mkdtempSync(path.join(root, '.smoke-data-design-'));
  app.setPath('userData', profile);
  app.disableHardwareAcceleration();
  nativeTheme.themeSource = 'light';
  require('../dist-main/main.js');
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (check, label) => {
    for (let i = 0; i < 100; i++) { if (await check()) return; await sleep(50); }
    throw new Error(`Timed out: ${label}`);
  };
  const timeout = setTimeout(() => { console.error('UI smoke timed out'); app.exit(1); }, 45000);
  app.whenReady().then(async () => {
    for (const file of ['icon.png', 'tray.png']) {
      const asset = nativeImage.createFromPath(path.join(root, 'assets', file));
      const pixels = asset.toBitmap();
      let opaque = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 200) opaque++;
      assert(opaque > pixels.length / 8, `${file} must contain visible artwork`);
    }
    await waitFor(() => BrowserWindow.getAllWindows().length === 2 && BrowserWindow.getAllWindows().every((w) => w.webContents.getURL() && !w.webContents.isLoading()), 'windows ready');
    const handle = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('mode=handle'));
    const panel = BrowserWindow.getAllWindows().find((w) => w !== handle);
    const js = (code) => panel.webContents.executeJavaScript(code);
    const hjs = (code) => handle.webContents.executeJavaScript(code);
    const click = (selector) => js(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const errors = [];
    panel.webContents.on('console-message', (_event, level, message) => { if (level === 3) errors.push(message); });
    await waitFor(() => hjs("Boolean(document.querySelector('.bookmark-tab'))"), 'handle rendered');
    assert(await hjs("(() => { const b = document.querySelector('button').getBoundingClientRect(); return b.width === 24 && b.height === 68 && b.right === innerWidth && b.top >= 0 && b.bottom <= innerHeight; })()"));
    assert.equal(handle.isFocusable(), false);
    await hjs("document.querySelector('button').dispatchEvent(new PointerEvent('pointerover', { bubbles: true }))");
    await waitFor(() => panel.isVisible() && !handle.isVisible(), 'hover opens panel');
    const area = screen.getAllDisplays().reduce((a, b) => a.workArea.x + a.workArea.width > b.workArea.x + b.workArea.width ? a : b).workArea;
    assert.equal(panel.getBounds().x + panel.getBounds().width, area.x + area.width);
    assert.equal(handle.getBounds().x + handle.getBounds().width, area.x + area.width);
    // Keep captures compact without changing the production window dimensions.
    panel.setBounds({ x: area.x + area.width - 400, y: area.y, width: 400, height: 800 });
    await waitFor(() => js("Boolean(document.querySelector('.empty-state'))"), 'empty state');
    const fill = async (value) => {
      await js(`(() => { const t = document.querySelector('.composer textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, ${JSON.stringify(value)}); t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    };
    await fill('整理今天的灵感');
    await click('.save-button');
    await waitFor(() => js("document.querySelectorAll('.todo-card').length === 1"), 'save text');
    await fill('准备明天的会议\n列好需要确认的事项');
    await js("document.querySelector('.composer textarea').dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}))");
    await waitFor(() => js("document.querySelectorAll('.todo-card').length === 2"), 'Enter saves text');
    const dataUrl = `data:image/png;base64,${fs.readFileSync(path.join(root, 'assets/icon.png')).toString('base64')}`;
    await js(`window.easyTodo.createTodo({ text: '保存一张截图，留住一个好点子', image: { dataUrl: ${JSON.stringify(dataUrl)}, mimeType: 'image/png' } })`);
    await panel.webContents.reload();
    await waitFor(() => js("document.querySelectorAll('.todo-card').length === 3 && document.querySelector('.todo-image img').complete"), 'image todo');
    const capture = async (filename) => {
      await sleep(150);
      const image = await panel.webContents.capturePage();
      const { width, height } = image.getSize();
      const pixels = image.toBitmap();
      const alphaAt = (x, y) => pixels[(y * width + x) * 4 + 3];
      assert.equal(alphaAt(0, 0), 0, `${filename}: top-left corner must be transparent`);
      assert.equal(alphaAt(0, height - 1), 0, `${filename}: bottom-left corner must be transparent`);
      assert.equal(alphaAt(Math.floor(width / 2), Math.floor(height / 2)), 255, `${filename}: paper must stay opaque`);
      fs.writeFileSync(path.join(root, filename), image.toPNG());
    };
    await capture('docs/preview.png');
    await capture('smoke-design-light.png');
    await click('.complete-button');
    await waitFor(() => js("document.querySelectorAll('.todo-card').length === 2 && Boolean(document.querySelector('.undo-toast'))"), 'complete todo');
    await click('.undo-toast button');
    await waitFor(() => js("document.querySelectorAll('.todo-card').length === 3"), 'undo completion');
    await click('.complete-button');
    await click('[aria-label="已归档"]');
    await waitFor(() => js("document.querySelectorAll('.todo-card.archived').length === 1"), 'archive view');
    await capture('smoke-design-archive.png');
    await click('[aria-label="恢复待办"]');
    await waitFor(() => js("Boolean(document.querySelector('.empty-state'))"), 'restore archive');
    await waitFor(() => js("!document.querySelector('.undo-toast')"), 'completion notification dismissed');
    await click('[aria-label="设置"]');
    await waitFor(() => js("Boolean(document.querySelector('.segmented-control'))"), 'settings');
    await capture('smoke-design-settings.png');
    await js("[...document.querySelectorAll('.segmented-control button')].find(b => b.textContent === '深色').click()");
    await waitFor(() => hjs("document.documentElement.dataset.theme === 'dark'"), 'handle theme sync');
    assert.equal(await js('document.documentElement.dataset.theme'), 'dark');
    await capture('smoke-design-settings-dark.png');
    await click('[aria-label="待办"]');
    await capture('docs/preview-dark.png');
    await js("window.easyTodo.hidePanel()");
    await waitFor(() => handle.isVisible() && !panel.isVisible(), 'collapse returns handle');
    fs.writeFileSync(path.join(root, 'smoke-design-handle-dark.png'), (await handle.webContents.capturePage()).toPNG());
    await hjs("window.easyTodo.updateSettings({ theme: 'system' })");
    await waitFor(() => hjs("document.documentElement.dataset.theme === 'light'"), 'handle follows light system');
    fs.writeFileSync(path.join(root, 'smoke-design-handle.png'), (await handle.webContents.capturePage()).toPNG());
    nativeTheme.themeSource = 'dark';
    await waitFor(() => hjs("document.documentElement.dataset.theme === 'dark'"), 'handle follows system theme change');
    await hjs("document.querySelector('button').click()");
    await waitFor(() => panel.isVisible(), 'handle click opens panel');
    panel.setBounds({ x: area.x + area.width - 400, y: area.y, width: 400, height: 600 });
    await js("window.easyTodo.updateSettings({theme:'light'})");
    await panel.webContents.reload();
    await waitFor(() => js("document.querySelectorAll('.todo-card').length === 3"), 'short window');
    assert(await js("document.querySelector('.todo-list').clientHeight > 150"));
    assert(await js("document.querySelector('.workspace').scrollWidth <= document.querySelector('.workspace').clientWidth"));
    await capture('smoke-design-compact.png');
    assert.deepEqual(errors, [], 'renderer console errors');
    console.log('UI smoke OK: text/image todos, Enter, archive/undo/restore, settings, live handle theme, hover/click/collapse, edge geometry, compact layout, transparent corners in light/dark themes.');
    clearTimeout(timeout);
    app.exit(0);
  }).catch((error) => { console.error(error); clearTimeout(timeout); app.exit(1); });
}
