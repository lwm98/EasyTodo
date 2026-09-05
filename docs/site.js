const preview = document.getElementById('app-preview');
const caption = document.getElementById('preview-caption');
const buttons = document.querySelectorAll('[data-preview]');

buttons.forEach((button) => {
  button.addEventListener('click', () => {
    const dark = button.dataset.preview === 'dark';
    preview.src = dark ? 'preview-dark.png' : 'preview.png';
    preview.alt = `EasyTodo ${dark ? '深色' : '浅色'}实机界面，展示文字、图片待办和日期分组`;
    caption.textContent = `${dark ? '深色' : '浅色'}主题 · 实际应用截图`;
    buttons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
  });
});
