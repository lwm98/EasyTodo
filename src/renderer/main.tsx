import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { CheckIcon, CloseIcon } from './icons';
import { applyTheme } from './theme';
import type { ThemePreference } from './types';

const params = new URLSearchParams(window.location.search);
const mode = params.get('mode');

function Handle() {
  const timer = React.useRef<number | undefined>(undefined);
  const [theme, setTheme] = React.useState<ThemePreference>('system');
  React.useEffect(() => {
    const unsubscribe = window.easyTodo.onSettingsChanged((settings) => setTheme(settings.theme));
    void window.easyTodo.getState().then((state) => setTheme(state.settings.theme));
    return () => { unsubscribe(); window.clearTimeout(timer.current); };
  }, []);
  React.useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyTheme(theme);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [theme]);
  const open = () => {
    window.clearTimeout(timer.current);
    window.easyTodo.showPanelFromHandle();
  };
  return (
    <button
      className="edge-handle"
      aria-label="打开 EasyTodo"
      onPointerEnter={() => { timer.current = window.setTimeout(open, 180); }}
      onPointerLeave={() => window.clearTimeout(timer.current)}
      onClick={open}
    >
      <span className="bookmark-tab"><CheckIcon /><span className="bookmark-grip" /></span>
    </button>
  );
}

function ImageViewer() {
  const imageId = params.get('imageId') ?? '';
  const [imageUrl, setImageUrl] = React.useState<string>();

  React.useEffect(() => {
    void window.easyTodo.getState().then((state) => {
      setImageUrl(state.todos.find((todo) => todo.id === imageId)?.imageUrl);
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') window.easyTodo.closeImage();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [imageId]);

  return (
    <main className="fullscreen-viewer" role="dialog" aria-modal="true" aria-label="查看截图" onClick={() => window.easyTodo.closeImage()}>
      <button className="viewer-close" aria-label="关闭图片" title="关闭 (Esc)" onClick={(event) => { event.stopPropagation(); window.easyTodo.closeImage(); }}><CloseIcon /></button>
      {imageUrl && <img src={imageUrl} alt="截图大图" onClick={(event) => event.stopPropagation()} onContextMenu={(event) => { event.preventDefault(); window.easyTodo.showImageContextMenu(imageId); }} />}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{mode === 'handle' ? <Handle /> : mode === 'viewer' ? <ImageViewer /> : <App />}</React.StrictMode>,
);
