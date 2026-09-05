export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemePreference;
  launchAtLogin: boolean;
  shortcut: string;
}

export interface Todo {
  id: string;
  text: string;
  imageFile?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface CreateTodoInput {
  text: string;
  image?: { dataUrl: string; mimeType: string };
}

export interface UpdateTodoInput {
  id: string;
  text: string;
  removeImage?: boolean;
}

export interface AppState {
  todos: Todo[];
  settings: Settings;
}

export interface SettingsResult {
  ok: boolean;
  error?: string;
  settings: Settings;
}
