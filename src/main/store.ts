import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  AppData,
  CreateTodoInput,
  Settings,
  StoredTodo,
  TodoView,
  UpdateTodoInput,
} from './types';

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  launchAtLogin: false,
  shortcut: 'CommandOrControl+Alt+Space',
};

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export class LocalStore {
  private readonly dataFile: string;
  readonly imagesDirectory: string;
  private data: AppData = { version: 1, todos: [], settings: DEFAULT_SETTINGS };
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly userDataDirectory: string) {
    this.dataFile = path.join(userDataDirectory, 'todos.json');
    this.imagesDirectory = path.join(userDataDirectory, 'images');
  }

  async initialize(): Promise<void> {
    await mkdir(this.imagesDirectory, { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(this.dataFile, 'utf8')) as Partial<AppData>;
      this.data = {
        version: 1,
        todos: Array.isArray(parsed.todos) ? parsed.todos : [],
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        const backup = path.join(this.userDataDirectory, `todos.corrupt.${Date.now()}.json`);
        try {
          await writeFile(backup, await readFile(this.dataFile));
        } catch {
          // A best-effort backup should never prevent the app from starting.
        }
      }
      await this.persist();
    }
  }

  getSettings(): Settings {
    return { ...this.data.settings };
  }

  async updateSettings(update: Partial<Settings>): Promise<Settings> {
    this.data.settings = { ...this.data.settings, ...update };
    await this.persist();
    return this.getSettings();
  }

  getTodos(): TodoView[] {
    return [...this.data.todos]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((todo) => ({
        ...todo,
        imageUrl: todo.imageFile
          ? `easytodo-media://local/${encodeURIComponent(todo.imageFile)}?v=${encodeURIComponent(todo.updatedAt)}`
          : undefined,
      }));
  }

  async createTodo(input: CreateTodoInput): Promise<TodoView> {
    const text = input.text.trim();
    if (!text && !input.image) {
      throw new Error('待办内容不能为空');
    }

    const now = new Date().toISOString();
    const todo: StoredTodo = {
      id: randomUUID(),
      text,
      createdAt: now,
      updatedAt: now,
    };

    if (input.image) {
      todo.imageFile = await this.saveImage(todo.id, input.image.dataUrl, input.image.mimeType);
    }

    this.data.todos.unshift(todo);
    await this.persist();
    return this.getTodos().find((item) => item.id === todo.id)!;
  }

  async updateTodo(input: UpdateTodoInput): Promise<void> {
    const todo = this.requireTodo(input.id);
    const nextText = input.text.trim();
    if (!nextText && (!todo.imageFile || input.removeImage)) {
      throw new Error('待办内容不能为空');
    }

    const removedImage = input.removeImage ? todo.imageFile : undefined;
    todo.text = nextText;
    todo.updatedAt = new Date().toISOString();
    if (input.removeImage) delete todo.imageFile;
    await this.persist();
    if (removedImage) await this.removeImage(removedImage);
  }

  async archiveTodo(id: string): Promise<void> {
    const todo = this.requireTodo(id);
    todo.archivedAt = new Date().toISOString();
    todo.updatedAt = todo.archivedAt;
    await this.persist();
  }

  async restoreTodo(id: string): Promise<void> {
    const todo = this.requireTodo(id);
    delete todo.archivedAt;
    todo.updatedAt = new Date().toISOString();
    await this.persist();
  }

  async deleteTodo(id: string): Promise<void> {
    const index = this.data.todos.findIndex((todo) => todo.id === id);
    if (index < 0) throw new Error('找不到这条待办');
    const [deleted] = this.data.todos.splice(index, 1);
    await this.persist();
    if (deleted.imageFile) await this.removeImage(deleted.imageFile);
  }

  private requireTodo(id: string): StoredTodo {
    const todo = this.data.todos.find((item) => item.id === id);
    if (!todo) throw new Error('找不到这条待办');
    return todo;
  }

  private async saveImage(id: string, dataUrl: string, mimeType: string): Promise<string> {
    const extension = IMAGE_EXTENSIONS[mimeType];
    if (!extension) throw new Error('不支持这种图片格式');
    const prefix = `data:${mimeType};base64,`;
    if (!dataUrl.startsWith(prefix)) throw new Error('图片数据无效');
    const buffer = Buffer.from(dataUrl.slice(prefix.length), 'base64');
    if (buffer.byteLength > 25 * 1024 * 1024) throw new Error('图片不能超过 25MB');
    const filename = `${id}${extension}`;
    await writeFile(path.join(this.imagesDirectory, filename), buffer);
    return filename;
  }

  private async removeImage(filename: string): Promise<void> {
    await rm(path.join(this.imagesDirectory, path.basename(filename)), { force: true });
  }

  private persist(): Promise<void> {
    const snapshot = JSON.stringify(this.data, null, 2);
    this.writeQueue = this.writeQueue.then(() => writeFile(this.dataFile, snapshot, 'utf8'));
    return this.writeQueue;
  }
}
