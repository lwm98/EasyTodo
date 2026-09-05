<div align="center">
  <img src="assets/icon.png" width="96" alt="EasyTodo 图标" />

  # EasyTodo

  **贴在 Windows 屏幕边缘的轻量待办工具**

  文字随手记，截图直接贴。需要时一划即开，不用时安静隐身。

  [![Platform](https://img.shields.io/badge/platform-Windows-0078D4?logo=windows&logoColor=white)](#系统要求)
  [![Electron](https://img.shields.io/badge/Electron-44-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
  [![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111)](https://react.dev/)
  [![License](https://img.shields.io/badge/license-MIT-6258D6)](LICENSE)
</div>

![EasyTodo 界面预览](docs/preview.png)

## 为什么是 EasyTodo？

很多待办工具需要先打开窗口、切换页面、选择清单，再开始输入。EasyTodo 把这条路径缩到最短：它常驻最右侧显示器边缘，鼠标悬停即可展开；也可以通过全局快捷键，从任何应用直接唤起输入框。

| 特性 | 带来的体验 |
| --- | --- |
| ⚡ **边缘呼出** | 右侧小把手悬停展开，不打断当前工作，也不抢焦点 |
| 📋 **剪贴板优先** | 支持纯文字、纯截图，以及“截图 + 说明”三种记录方式 |
| 🔒 **真正本地优先** | 无账号、无云端、无数据库，待办和截图只保存在你的电脑上 |
| ⌨️ **键盘友好** | 全局快捷键唤起，`Enter` 保存，几乎不用离开键盘 |
| 🧹 **完成即归档** | 完成、撤销、恢复、编辑、删除一应俱全，主列表始终保持清爽 |
| 🌓 **融入 Windows** | 跟随系统深浅色主题，支持托盘运行、开机启动和多显示器 |

## 功能亮点

- 自动定位最右侧显示器，并以窄小把手常驻屏幕中部
- 鼠标悬停无焦点展开；移开后自动收起
- `Ctrl+V` 直接把剪贴板截图变成待办，支持 PNG、JPEG、WebP 和 GIF
- 待办按创建日期分组，完成后自动归档，并提供 5 秒撤销入口
- 双击文字编辑，双击截图查看大图
- 删除含截图的待办时同步清理本地图片文件
- 浅色、深色或跟随系统三种主题模式
- 可配置全局快捷键与开机启动
- 单实例运行、系统托盘菜单和多显示器变化自动适配
- 本地数据损坏时尽力备份原文件，降低数据丢失风险

## 快速开始

### 系统要求

- Windows 10 / 11（x64）
- Node.js 20 或更高版本
- npm 10 或更高版本

### 本地开发

```powershell
git clone https://github.com/lwm98/easyTodo.git
cd easyTodo
npm install
npm run dev
```

### 构建

```powershell
# 类型检查并构建主进程与界面
npm run build

# 生成 Windows NSIS 安装包
npm run dist
```

构建产物会输出到 `release/`。

## 快捷操作

| 操作 | 效果 |
| --- | --- |
| 悬停屏幕最右侧中部的小把手 | 展开面板但不抢焦点 |
| `Ctrl` + `Alt` + `Space` | 从任意应用打开并聚焦输入框 |
| `Ctrl` + `V` | 粘贴文字或截图 |
| `Enter` | 保存待办 |
| `Shift` + `Enter` | 输入换行 |
| 双击待办文字 | 编辑待办 |
| 双击待办截图 | 查看大图 |
| `Esc` | 关闭弹窗或收起面板 |

> 全局快捷键可在设置中修改。若快捷键已被其他应用占用，EasyTodo 会保留原设置并给出提示。

## 数据与隐私

EasyTodo 不发送遥测，也不依赖任何在线服务。应用数据保存在 Electron 的 `userData` 目录：

```text
userData/
├── todos.json    # 待办和设置
└── images/       # 待办中的截图
```

这意味着数据完全由你掌控，也方便自行备份或迁移。

## 技术栈

- Electron 44
- React 19
- TypeScript 7
- Vite 8
- electron-builder

渲染进程启用了 `contextIsolation` 和沙箱，并通过受限的 preload API 与主进程通信。

## 可用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动 Vite 与 Electron 开发环境 |
| `npm run typecheck` | 检查渲染进程和主进程类型 |
| `npm run test:store` | 运行本地存储冒烟测试 |
| `npm run build` | 完成类型检查并构建应用 |
| `npm run dist` | 生成 Windows 安装包 |

## 参与贡献

欢迎提交 Issue、功能建议与 Pull Request。开始修改前，建议先运行：

```powershell
npm install
npm run typecheck
npm run test:store
```

## 开源许可

本项目基于 [MIT License](LICENSE) 开源。

<div align="center">
  <sub>让记录一件事，真的只需要一瞬间。</sub>
</div>
