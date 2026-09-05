export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemePreference;
  launchAtLogin: boolean;
  shortcut: string;
}

export interface StoredTodo {
  id: string;
  text: string;
  imageFile?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface TodoView extends StoredTodo {
  imageUrl?: string;
}

export interface AppData {
  version: 1;
  todos: StoredTodo[];
  settings: Settings;
}

export interface CreateTodoInput {
  text: string;
  image?: {
    dataUrl: string;
    mimeType: string;
  };
}

export interface UpdateTodoInput {
  id: string;
  text: string;
  removeImage?: boolean;
}
