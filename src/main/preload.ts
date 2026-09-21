import { contextBridge, ipcRenderer } from 'electron';
import type { CreateTodoInput, Settings, UpdateTodoInput } from './types';

contextBridge.exposeInMainWorld('easyTodo', {
  getState: () => ipcRenderer.invoke('state:get'),
  createTodo: (input: CreateTodoInput) => ipcRenderer.invoke('todo:create', input),
  updateTodo: (input: UpdateTodoInput) => ipcRenderer.invoke('todo:update', input),
  archiveTodo: (id: string) => ipcRenderer.invoke('todo:archive', id),
  restoreTodo: (id: string) => ipcRenderer.invoke('todo:restore', id),
  deleteTodo: (id: string) => ipcRenderer.invoke('todo:delete', id),
  updateSettings: (update: Partial<Settings>) => ipcRenderer.invoke('settings:update', update),
  showPanelFromHandle: () => ipcRenderer.send('panel:show-inactive'),
  requestCollapse: () => ipcRenderer.send('panel:collapse'),
  hidePanel: () => ipcRenderer.send('panel:hide'),
  openImage: (imageId: string) => ipcRenderer.invoke('image:open', imageId),
  closeImage: () => ipcRenderer.send('image:close'),
  showImageContextMenu: (imageId: string) => ipcRenderer.send('image:context-menu', imageId),
  onSettingsChanged: (callback: (settings: Settings) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, settings: Settings) => callback(settings);
    ipcRenderer.on('settings:changed', listener);
    return () => ipcRenderer.removeListener('settings:changed', listener);
  },
  onFocusComposer: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('panel:focus-composer', listener);
    return () => ipcRenderer.removeListener('panel:focus-composer', listener);
  },
  onNavigate: (callback: (view: 'active' | 'archive' | 'settings') => void) => {
    const listener = (_event: Electron.IpcRendererEvent, view: 'active' | 'archive' | 'settings') => callback(view);
    ipcRenderer.on('panel:navigate', listener);
    return () => ipcRenderer.removeListener('panel:navigate', listener);
  },
});
