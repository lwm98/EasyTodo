import type { AppState, CreateTodoInput, Settings, SettingsResult, UpdateTodoInput } from './types';

declare global {
  interface Window {
    easyTodo: {
      getState(): Promise<AppState>;
      createTodo(input: CreateTodoInput): Promise<void>;
      updateTodo(input: UpdateTodoInput): Promise<void>;
      archiveTodo(id: string): Promise<void>;
      restoreTodo(id: string): Promise<void>;
      deleteTodo(id: string): Promise<void>;
      updateSettings(update: Partial<Settings>): Promise<SettingsResult>;
      showPanelFromHandle(): void;
      requestCollapse(): void;
      hidePanel(): void;
      onSettingsChanged(callback: (settings: Settings) => void): () => void;
      onFocusComposer(callback: () => void): () => void;
      onNavigate(callback: (view: 'active' | 'archive' | 'settings') => void): () => void;
    };
  }
}

export {};
