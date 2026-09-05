import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { CheckIcon } from './icons';
import { applyTheme } from './theme';
import type { ThemePreference } from './types';

const isHandle = new URLSearchParams(window.location.search).get('mode') === 'handle';

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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isHandle ? <Handle /> : <App />}</React.StrictMode>,
);
