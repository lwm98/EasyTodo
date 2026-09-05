const { LocalStore } = require('../dist-main/store.js');
const fs = require('node:fs/promises');
const path = require('node:path');

const image = {
  mimeType: 'image/png',
  dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
};

async function run() {
  const directory = await fs.mkdtemp(path.join(process.cwd(), '.logic-test-'));
  try {
    const store = new LocalStore(directory);
    await store.initialize();
    const textTodo = await store.createTodo({ text: '文字待办' });
    const imageTodo = await store.createTodo({ text: '', image });
    const mixedTodo = await store.createTodo({ text: '图文待办', image });

    if (store.getTodos().length !== 3) throw new Error('create failed');
    await store.archiveTodo(textTodo.id);
    if (!store.getTodos().find((todo) => todo.id === textTodo.id).archivedAt) {
      throw new Error('archive failed');
    }
    await store.restoreTodo(textTodo.id);
    await store.updateTodo({ id: mixedTodo.id, text: '修改后', removeImage: true });
    if (store.getTodos().find((todo) => todo.id === mixedTodo.id).imageFile) {
      throw new Error('remove image failed');
    }
    await store.deleteTodo(imageTodo.id);
    if (store.getTodos().length !== 2) throw new Error('delete failed');
    process.stdout.write('LocalStore lifecycle OK\n');
  } finally {
    const workspacePrefix = `${process.cwd()}${path.sep}`;
    if (!directory.startsWith(workspacePrefix)) throw new Error('unsafe temporary path');
    await fs.rm(directory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
