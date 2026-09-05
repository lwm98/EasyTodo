// Render the shared vector source with Electron so UI, tray and installer match.
const fs = require('node:fs');
const path = require('node:path');

if (!process.versions.electron) {
  const { spawnSync } = require('node:child_process');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(require('electron'), [__filename], { env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
} else {
  const { app, BrowserWindow } = require('electron');
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('force-device-scale-factor', '1');
  app.whenReady().then(async () => {
    const assets = path.join(__dirname, '../assets');
    const svg = fs.readFileSync(path.join(assets, 'icon.svg'), 'utf8');
    const window = new BrowserWindow({ width: 256, height: 256, show: false, frame: false, transparent: true,
      webPreferences: { offscreen: true, contextIsolation: true, sandbox: true } });
    const painted = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Icon rendering timed out')), 15000);
      const onPaint = (_event, _rectangle, image) => {
        // Offscreen windows may paint an empty transparent frame before navigation.
        // Only accept the fully painted icon, never that initial frame.
        const pixels = image.toBitmap();
        let paintedPixels = 0;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 200) paintedPixels++;
        if (paintedPixels < 40000) return;
        clearTimeout(timeout);
        window.webContents.removeListener('paint', onPaint);
        resolve(image);
      };
      window.webContents.on('paint', onPaint);
    });
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<style>html,body{margin:0;background:transparent;overflow:hidden}svg{display:block}</style>${svg}`)}`);
    window.webContents.invalidate();
    const icon = await painted;
    fs.writeFileSync(path.join(assets, 'icon.png'), icon.toPNG());
    fs.writeFileSync(path.join(assets, 'tray.png'), icon.resize({ width: 32, height: 32 }).toPNG());
    console.log('Generated assets/icon.png and assets/tray.png from assets/icon.svg');
    window.destroy();
    app.quit();
  }).catch((error) => { console.error(error); app.exit(1); });
}
