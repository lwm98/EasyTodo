import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArchiveIcon,
  CheckIcon,
  CloseIcon,
  ImageIcon,
  InboxIcon,
  RestoreIcon,
  SettingsIcon,
  TrashIcon,
  SunIcon,
} from './icons';
import type { AppState, Settings, Todo } from './types';
import brandIcon from '../../assets/icon.svg';
import { applyTheme } from './theme';

type View = 'active' | 'archive' | 'settings';

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  launchAtLogin: false,
  shortcut: 'CommandOrControl+Alt+Space',
};

function dataUrlFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateGroupLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDifference = Math.round((startToday - startDate) / 86_400_000);
  if (dayDifference === 0) return '今天';
  if (dayDifference === 1) return '昨天';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(date);
}

function formatCreatedTime(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));
}

export function App() {
  const [state, setState] = useState<AppState>({ todos: [], settings: DEFAULT_SETTINGS });
  const [view, setView] = useState<View>('active');
  const [draft, setDraft] = useState('');
  const [pendingImage, setPendingImage] = useState<{ dataUrl: string; mimeType: string }>();
  const [editing, setEditing] = useState<Todo>();
  const [editText, setEditText] = useState('');
  const [removeEditImage, setRemoveEditImage] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Todo>();
  const [undoTodo, setUndoTodo] = useState<Todo>();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [shortcutDraft, setShortcutDraft] = useState(DEFAULT_SETTINGS.shortcut);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const pointerInside = useRef(true);
  const collapseTimer = useRef<number | undefined>(undefined);
  const undoTimer = useRef<number | undefined>(undefined);

  const reload = useCallback(async () => {
    const next = await window.easyTodo.getState();
    setState(next);
    setShortcutDraft(next.settings.shortcut);
    applyTheme(next.settings.theme);
  }, []);

  useEffect(() => {
    void reload();
    const media = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => state.settings.theme === 'system' && applyTheme('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [reload, state.settings.theme]);

  useEffect(() => {
    const removeFocusListener = window.easyTodo.onFocusComposer(() => {
      setView('active');
      requestAnimationFrame(() => composerRef.current?.focus());
    });
    const removeNavigationListener = window.easyTodo.onNavigate((nextView) => setView(nextView));
    return () => {
      removeFocusListener();
      removeNavigationListener();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (deleteTarget) setDeleteTarget(undefined);
      else if (editing) setEditing(undefined);
      else window.easyTodo.hidePanel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteTarget, editing]);

  const activeTodos = useMemo(() => state.todos.filter((todo) => !todo.archivedAt), [state.todos]);
  const archivedTodos = useMemo(() => state.todos.filter((todo) => todo.archivedAt), [state.todos]);
  const visibleTodos = view === 'archive' ? archivedTodos : activeTodos;
  const todoGroups = useMemo(() => {
    const groups = new Map<string, { label: string; todos: Todo[] }>();
    for (const todo of visibleTodos) {
      const key = dateKey(new Date(todo.createdAt));
      const group = groups.get(key) ?? { label: dateGroupLabel(todo.createdAt), todos: [] };
      group.todos.push(todo);
      groups.set(key, group);
    }
    return [...groups.values()];
  }, [visibleTodos]);

  const scheduleCollapse = () => {
    pointerInside.current = false;
    window.clearTimeout(collapseTimer.current);
    const interactionLocked = Boolean(
      document.activeElement === composerRef.current || editing || deleteTarget,
    );
    if (!interactionLocked) {
      collapseTimer.current = window.setTimeout(() => window.easyTodo.requestCollapse(), 500);
    }
  };

  const cancelCollapse = () => {
    pointerInside.current = true;
    window.clearTimeout(collapseTimer.current);
  };

  const handlePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imageItem = [...event.clipboardData.items].find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    event.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
    try {
      setPendingImage({ dataUrl: await dataUrlFromFile(file), mimeType: file.type || 'image/png' });
      setError('');
    } catch {
      setError('无法读取剪贴板图片');
    }
  };

  const createTodo = async () => {
    if ((!draft.trim() && !pendingImage) || saving) return;
    setSaving(true);
    try {
      await window.easyTodo.createTodo({ text: draft, image: pendingImage });
      setDraft('');
      setPendingImage(undefined);
      setError('');
      await reload();
      composerRef.current?.focus();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const archiveTodo = async (todo: Todo) => {
    await window.easyTodo.archiveTodo(todo.id);
    setUndoTodo(todo);
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndoTodo(undefined), 5000);
    await reload();
  };

  const undoArchive = async () => {
    if (!undoTodo) return;
    await window.easyTodo.restoreTodo(undoTodo.id);
    setUndoTodo(undefined);
    window.clearTimeout(undoTimer.current);
    await reload();
  };

  const beginEdit = (todo: Todo) => {
    setEditing(todo);
    setEditText(todo.text);
    setRemoveEditImage(false);
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await window.easyTodo.updateTodo({ id: editing.id, text: editText, removeImage: removeEditImage });
      setEditing(undefined);
      setError('');
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await window.easyTodo.deleteTodo(deleteTarget.id);
    setDeleteTarget(undefined);
    await reload();
  };

  const updateSettings = async (update: Partial<Settings>) => {
    const result = await window.easyTodo.updateSettings(update);
    if (!result.ok) {
      setError(result.error ?? '设置保存失败');
      setShortcutDraft(result.settings.shortcut);
      return;
    }
    setState((current) => ({ ...current, settings: result.settings }));
    applyTheme(result.settings.theme);
    setError('');
  };

  return (
    <main className="app-shell" onPointerEnter={cancelCollapse} onPointerLeave={scheduleCollapse}>
      <aside className="sidebar">
        <div className="brand"><img src={brandIcon} alt="EasyTodo 笑脸便签" /></div>
        <nav aria-label="主菜单">
          <NavButton label="待办" active={view === 'active'} count={activeTodos.length} onClick={() => setView('active')}><InboxIcon /></NavButton>
          <NavButton label="已归档" active={view === 'archive'} onClick={() => setView('archive')}><ArchiveIcon /></NavButton>
        </nav>
        <div className="sidebar-bottom">
          <NavButton label="设置" active={view === 'settings'} onClick={() => setView('settings')}><SettingsIcon /></NavButton>
        </div>
      </aside>

      <section className="workspace">
        <header className="window-header">
          <div>
            <p className="eyebrow">EasyTodo <span>随手记，慢慢做</span></p>
            <h1>{view === 'active' ? '待办' : view === 'archive' ? '已归档' : '设置'}</h1>
          </div>
          <button className="icon-button close-window" aria-label="隐藏到托盘" title="隐藏到托盘" onClick={() => window.easyTodo.hidePanel()}><CloseIcon /></button>
        </header>

        {view === 'active' && (
          <section className="composer" aria-label="新建待办">
            {pendingImage && (
              <div className="pending-image">
                <img src={pendingImage.dataUrl} alt="待保存截图" />
                <button className="image-remove" onClick={() => setPendingImage(undefined)} aria-label="移除截图"><CloseIcon /></button>
              </div>
            )}
            <textarea
              ref={composerRef}
              value={draft}
              rows={pendingImage ? 2 : 3}
              placeholder={pendingImage ? '给这张截图写点说明…' : '记录一件事…'}
              onChange={(event) => setDraft(event.target.value)}
              onPaste={handlePaste}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void createTodo();
                }
              }}
            />
            <div className="composer-footer">
              <span className="composer-hints"><span><ImageIcon /><kbd>Ctrl</kbd> + <kbd>V</kbd> 粘贴截图</span><span>Enter 保存 · Shift+Enter 换行</span></span>
              <button className="save-button" disabled={(!draft.trim() && !pendingImage) || saving} onClick={() => void createTodo()}><CheckIcon />{saving ? '保存中' : '保存'}</button>
            </div>
          </section>
        )}

        {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError('')}><CloseIcon /></button></div>}

        {(view === 'active' || view === 'archive') && (
          <section className="todo-list" aria-live="polite">
            <div className="list-heading">
              <span>{view === 'active' ? `${activeTodos.length} 项待办` : `${archivedTodos.length} 项已完成`}</span>
            </div>
            {visibleTodos.length === 0 ? (
              <EmptyState archive={view === 'archive'} />
            ) : (
              todoGroups.map((group) => (
                <div className="day-group" key={group.label}>
                  <h2><SunIcon />{group.label}<span className="group-line" /></h2>
                  {group.todos.map((todo) => (
                    <TodoCard
                      key={todo.id}
                      todo={todo}
                      archived={view === 'archive'}
                      onArchive={() => void archiveTodo(todo)}
                      onRestore={async () => { await window.easyTodo.restoreTodo(todo.id); await reload(); }}
                      onDelete={() => setDeleteTarget(todo)}
                      onEdit={() => beginEdit(todo)}
                      onZoom={() => void window.easyTodo.openImage(todo.id).catch(() => setError('无法打开图片'))}
                    />
                  ))}
                </div>
              ))
            )}
          </section>
        )}

        {view === 'settings' && (
          <SettingsPanel
            settings={state.settings}
            shortcutDraft={shortcutDraft}
            setShortcutDraft={setShortcutDraft}
            onUpdate={updateSettings}
          />
        )}
      </section>

      {undoTodo && <div className="undo-toast"><span>已完成“{undoTodo.text || '图片待办'}”</span><button onClick={() => void undoArchive()}>撤销</button></div>}

      {editing && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setEditing(undefined)}>
          <section className="modal" role="dialog" aria-modal="true" aria-label="编辑待办">
            <div className="modal-title"><h2>编辑待办</h2><button className="icon-button" onClick={() => setEditing(undefined)}><CloseIcon /></button></div>
            {editing.imageUrl && !removeEditImage && (
              <div className="edit-image"><img src={editing.imageUrl} alt="待办截图" onContextMenu={(event) => { event.preventDefault(); window.easyTodo.showImageContextMenu(editing.id); }} /><button onClick={() => setRemoveEditImage(true)}><TrashIcon />移除图片</button></div>
            )}
            <textarea autoFocus value={editText} rows={5} placeholder="添加文字说明" onChange={(event) => setEditText(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void saveEdit(); }
            }} />
            <div className="modal-actions"><button className="secondary-button" onClick={() => setEditing(undefined)}>取消</button><button className="primary-button" onClick={() => void saveEdit()}>保存</button></div>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal confirm-modal" role="alertdialog" aria-modal="true">
            <div className="danger-icon"><TrashIcon /></div>
            <h2>确定删除这条待办？</h2>
            <p>删除后无法恢复{deleteTarget.imageFile ? '，对应截图也会一并删除' : ''}。</p>
            <div className="modal-actions"><button className="secondary-button" onClick={() => setDeleteTarget(undefined)}>取消</button><button className="danger-button" onClick={() => void confirmDelete()}>确认删除</button></div>
          </section>
        </div>
      )}

    </main>
  );
}

function NavButton({ label, active, count, onClick, children }: { label: string; active: boolean; count?: number; onClick(): void; children: React.ReactNode }) {
  return <button className={`nav-button ${active ? 'active' : ''}`} aria-label={label} aria-current={active ? 'page' : undefined} title={label} onClick={onClick}>{children}<span className="nav-label">{label === '已归档' ? '归档' : label}</span>{typeof count === 'number' && count > 0 && <span className="nav-count">{count > 99 ? '99+' : count}</span>}</button>;
}

function TodoCard({ todo, archived, onArchive, onRestore, onDelete, onEdit, onZoom }: { todo: Todo; archived: boolean; onArchive(): void; onRestore(): void; onDelete(): void; onEdit(): void; onZoom(): void }) {
  return (
    <article className={`todo-card ${archived ? 'archived' : ''}`}>
      <button className={`complete-button ${archived ? 'done' : ''}`} aria-label={archived ? '已完成' : '标记完成'} onClick={archived ? undefined : onArchive}>{archived && <CheckIcon />}</button>
      <div className="todo-content" onDoubleClick={onEdit}>
        {todo.imageUrl && <button className="todo-image" onDoubleClick={(event) => { event.stopPropagation(); onZoom(); }} onContextMenu={(event) => { event.preventDefault(); window.easyTodo.showImageContextMenu(todo.id); }} title="双击全屏查看"><img src={todo.imageUrl} alt="待办截图" /></button>}
        {todo.text && <p>{todo.text}</p>}
        <time dateTime={todo.createdAt}>{formatCreatedTime(todo.createdAt)}</time>
      </div>
      <div className="todo-actions">
        {archived && <button className="icon-button" aria-label="恢复待办" title="恢复" onClick={onRestore}><RestoreIcon /></button>}
        <button className="icon-button danger-hover" aria-label="删除待办" title="删除" onClick={onDelete}><TrashIcon /></button>
      </div>
    </article>
  );
}

function EmptyState({ archive }: { archive: boolean }) {
  return <div className="empty-state"><div className="empty-illustration"><img src={brandIcon} alt="" />{archive ? <ArchiveIcon /> : <SunIcon />}</div><h2>{archive ? '完成的小事，都收在这里' : '今天，慢慢来就好'}</h2><p>{archive ? '完成一条待办，就会自动归档' : '记下一件小事，或贴一张截图'}</p></div>;
}

function SettingsPanel({ settings, shortcutDraft, setShortcutDraft, onUpdate }: { settings: Settings; shortcutDraft: string; setShortcutDraft(value: string): void; onUpdate(update: Partial<Settings>): Promise<void> }) {
  return (
    <section className="settings-panel">
      <div className="setting-group">
        <div className="setting-copy"><h2>主题</h2><p>默认跟随 Windows，也可以固定主题。</p></div>
        <div className="segmented-control">
          {([['system', '跟随系统'], ['light', '浅色'], ['dark', '深色']] as const).map(([value, label]) => (
            <button key={value} className={settings.theme === value ? 'active' : ''} onClick={() => void onUpdate({ theme: value })}>{label}</button>
          ))}
        </div>
      </div>
      <div className="setting-group setting-row">
        <div className="setting-copy"><h2>开机启动</h2><p>登录 Windows 后自动在托盘运行。</p></div>
        <button className={`switch ${settings.launchAtLogin ? 'on' : ''}`} role="switch" aria-checked={settings.launchAtLogin} onClick={() => void onUpdate({ launchAtLogin: !settings.launchAtLogin })}><span /></button>
      </div>
      <div className="setting-group">
        <div className="setting-copy"><h2>全局快捷键</h2><p>从任何软件中快速打开并聚焦输入框。</p></div>
        <div className="shortcut-editor">
          <input value={shortcutDraft} onChange={(event) => setShortcutDraft(event.target.value)} spellCheck={false} />
          <button className="primary-button" disabled={!shortcutDraft.trim() || shortcutDraft === settings.shortcut} onClick={() => void onUpdate({ shortcut: shortcutDraft.trim() })}>应用</button>
        </div>
        <p className="setting-hint">默认：CommandOrControl+Alt+Space</p>
      </div>
      <div className="about-card"><div className="brand small"><img src={brandIcon} alt="" /></div><div><strong>EasyTodo</strong><span>把小事记下来，把轻松留给自己。</span></div></div>
    </section>
  );
}
