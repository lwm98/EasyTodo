import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';

const isHandle = new URLSearchParams(window.location.search).get('mode') === 'handle';

function Handle() {
  return (
    <button
      className="edge-handle"
      aria-label="打开 EasyTodo"
      onPointerEnter={() => window.easyTodo.showPanelFromHandle()}
    >
      <span />
    </button>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isHandle ? <Handle /> : <App />}</React.StrictMode>,
);
