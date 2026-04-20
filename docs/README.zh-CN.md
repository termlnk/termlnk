<div align="center">

<h1>
<img src="screenshots/logo.png" alt="Termlnk" width="64" /><br />
Termlnk
</h1>

为开发者打造的现代化、可扩展智能终端。<br />
**SSH &amp; SFTP &middot; AI Agent with MCP &middot; 71 款主题 &middot; 插件生态 &middot; 跨平台。**

[English][readme-en-link] | **简体中文** | [繁體中文][readme-zh-tw-link] | [日本語][readme-ja-link] | [한국어][readme-ko-link]

[![][license-shield]][license-link]
[![][release-shield]][releases-link]
[![][downloads-shield]][releases-link]
[![][platform-shield]][platform-link]

</div>

---

<p align="center">
  <img src="./screenshots/termlnk.png" alt="Termlnk" />
</p>

<details open>
<summary>
<strong>目录</strong>
</summary>

- [🌈 亮点](#-亮点)
- [✨ 功能](#-功能)
    - [🖥 终端与会话](#-终端与会话)
    - [🔐 SSH 与 SFTP](#-ssh-与-sftp)
    - [🤖 AI Agent](#-ai-agent)
    - [🧩 插件系统](#-插件系统)
    - [🎨 主题系统](#-主题系统)
- [📸 截图](#-截图)
- [🚀 快速开始](#-快速开始)
- [💻 平台与安装说明](#-平台与安装说明)
- [🛠 开发](#-开发)
- [🌐 国际化](#-国际化)
- [🤝 贡献](#-贡献)
- [💬 社区](#-社区)
- [📄 许可证](#-许可证)

</details>

## 🌈 亮点

- 🖥 **跨平台原生终端** — 本地优先，完全离线可用，支持 macOS（Intel 与 Apple Silicon）、Windows、Linux。
- 🔐 **功能完备的 SSH 客户端** — 树形主机浏览器、密钥认证、代理跳板、X11 转发。
- 🤖 **内置 AI Agent** — 多轮对话 + MCP 工具调用，可在 OpenAI、Claude、Gemini、DeepSeek、Qwen 或任意 OpenAI 兼容端点之间自由切换。
- 📂 **SFTP 文件浏览** — 双面板布局、拖拽传输、批量操作、权限编辑。
- 🎨 **71 款开箱即用主题** — 兼容 NvChad Base46（56 暗色 + 15 亮色），内置主题编辑器。
- 🧩 **插件化架构** — 类 VS Code 贡献点机制，支持插件市场一键安装。
- 🪟 **工作区分屏** — 递归二叉树布局，可拖拽调整，支持放大模式。
- 🔗 **Shell 集成** — OSC 633 命令追踪、目录同步、AI 辅助的 `terminal_run`。
- 🏝 **灵动岛（macOS）** — 适配刘海屏的 AI Agent 会话浮动状态提示，支持会话启动、任务完成、待审批与错误等事件的音效自定义。
- 🪟 **透明与深度定制** — 可配置模糊、透明度、字体与快捷键。

## ✨ 功能

### 🖥 终端与会话

- 同一工作区内并存本地 PTY 与远程 SSH 会话。
- 递归分屏布局：水平、垂直、放大，可拖拽调整。
- 完整 xterm.js 渲染：连字、真彩色、Sixel、图像协议。
- 内置缓冲区搜索、超链接识别、IME 输入。
- 重启后自动恢复会话，支持按工作区持久化。

### 🔐 SSH 与 SFTP

- 层级化主机树，支持分组、标签、拖拽排序。
- 密码、私钥、SSH Agent 认证。
- 代理跳板链（`ProxyJump`）与 SOCKS5 代理。
- X11 转发，`trzsz` / `zmodem` 文件传输。
- 双面板 SFTP，带传输队列、权限编辑、批量操作。

### 🤖 AI Agent

- 聊天面板支持 Markdown 与代码高亮渲染。
- MCP（Model Context Protocol）客户端，可连接本地与远程工具服务器。
- Provider 注册表：OpenAI、Anthropic、Google Gemini、DeepSeek、Qwen 或任意 OpenAI 兼容端点。
- `terminal_run` 工具让 Agent 在指定终端中执行命令（需用户确认）。
- Skill 的发现、安装与按会话启用。

### 🧩 插件系统

- 类 VS Code 贡献点：命令、菜单、UI 部件、设置。
- 插件市场的发现、安装、启用、禁用流程。
- 隔离的插件运行时，提供稳定的 TypeScript API。
- 可将自定义 React 组件注入任意 `BuiltInUIPart` 位置。

### 🎨 主题系统

- 71 款内置 Base46 主题 — 56 暗色、15 亮色。
- 分元素定制：终端、窗口、语法高亮。
- 实时预览主题编辑器。
- Tailwind CSS v4 + `tm:` colon 前缀在应用内使用。

## 📸 截图

<table>
<tr>
<td width="25%"><img src="screenshots/workspace.png" alt="工作区" /></td>
<td width="25%"><img src="screenshots/ssh-split.png" alt="SSH 分屏" /></td>
<td width="25%"><img src="screenshots/drag-split-screen.png" alt="拖拽分屏" /></td>
<td width="25%"><img src="screenshots/terminal-maximize.png" alt="终端放大" /></td>
</tr>
<tr>
<td align="center"><b>工作区</b></td>
<td align="center"><b>SSH 分屏</b></td>
<td align="center"><b>拖拽分屏</b></td>
<td align="center"><b>窗格放大</b></td>
</tr>
<tr>
<td width="25%"><img src="screenshots/agent.png" alt="AI Agent" /></td>
<td width="25%"><img src="screenshots/sftp.png" alt="SFTP" /></td>
<td width="25%"><img src="screenshots/themes.png" alt="主题" /></td>
<td width="25%"><img src="screenshots/transparent.png" alt="透明窗口" /></td>
</tr>
<tr>
<td align="center"><b>AI Agent</b></td>
<td align="center"><b>SFTP 浏览器</b></td>
<td align="center"><b>71 款主题</b></td>
<td align="center"><b>透明窗口</b></td>
</tr>
</table>

## 🚀 快速开始

### 从源码构建

```bash
git clone https://github.com/termlnk/termlnk.git
cd termlnk
pnpm install

cd apps/desktop
pnpm dev
```

### 打包安装程序

```bash
cd apps/desktop
pnpm make:mac      # macOS .dmg / .zip
pnpm make:win      # Windows .exe / .msi
pnpm make:linux    # Linux .AppImage / .deb / .rpm
```

> **说明：** 预编译二进制尚未发布。构建产物可用后会出现在 [GitHub Releases][releases-link] 页面。

## 💻 平台与安装说明

macOS 构建使用 Developer ID 证书签名，但未经 Apple 公证，首次启动时 Gatekeeper 可能仍会弹窗警告。Windows 与 Linux 构建未签名。

<details>
<summary>macOS：首次启动时的 Gatekeeper 警告</summary>

**方案 1** — 在 Finder 中右键点击 `Termlnk.app` > 打开 > 确认。

**方案 2** — 系统设置 > 隐私与安全性 > 滚动到「安全性」区域 > 点击「仍要打开」。

**方案 3** — 在终端中执行：

```bash
xattr -cr /Applications/Termlnk.app
```

</details>

<details>
<summary>Windows：SmartScreen 拦截安装程序</summary>

**方案 1** — 在 SmartScreen 对话框中点击「更多信息」，再点击「仍要运行」。

**方案 2** — 设置 > 应用 > 应用高级设置 > 将「选择获取应用的位置」设为任何来源。

</details>

## 🛠 开发

```bash
pnpm build          # 构建所有库包
pnpm typecheck      # 类型检查
pnpm test           # 单元测试
pnpm coverage       # 测试 + 覆盖率报告
pnpm lint           # Lint
pnpm lint:fix       # 自动修复 lint 问题（同时会注入 license header）
```

## 🌐 国际化

Termlnk 开箱支持 5 种语言：

| 语言 | 代码 |
| :--- | :--- |
| English | `en-US` |
| 简体中文 | `zh-CN` |
| 繁體中文 | `zh-TW` |
| 日本語 | `ja-JP` |
| 한국어 | `ko-KR` |

按 [贡献指南](#-贡献) 参与新语言的添加。

## 🤝 贡献

欢迎贡献代码。在提交 Pull Request 前请确保：

1. Fork 仓库并创建特性分支。
2. 遵守项目代码规范与 RxJS 响应式编程规范。
3. 本地 `pnpm lint` 与 `pnpm test` 全部通过。
4. 向 `main` 提 PR，标题遵循 Conventional Commits（`feat:` / `fix:` / `refactor:` / `chore:` …）。

## 💬 社区

- [GitHub Discussions][github-community-link] — 提问、交流想法。
- [GitHub Issues][github-issues-link] — 反馈 bug、提功能需求。

## 📄 许可证

Copyright © 2026-present Termlnk。

本项目采用 [**PolyForm Noncommercial License 1.0.0**][license-link]。**禁止任何商业用途。** Fork 与衍生作品必须同样开源且非商业，并以相同协议发布。

"Termlnk" 名称、Logo 和其他 Termlnk 标识是本项目的商标。源代码协议**不授予**任何商标使用权利——详见 [TRADEMARK.md][trademark-link]。

<!-- Language switcher -->
[readme-en-link]: ../README.md
[readme-zh-tw-link]: ./README.zh-TW.md
[readme-ja-link]: ./README.ja.md
[readme-ko-link]: ./README.ko.md

<!-- Badges -->
[license-shield]: https://img.shields.io/badge/license-PolyForm%20Noncommercial-orange.svg?style=flat-square
[license-link]: ../LICENSE
[release-shield]: https://img.shields.io/github/v/release/termlnk/termlnk?style=flat-square
[downloads-shield]: https://img.shields.io/github/downloads/termlnk/termlnk/total?style=flat-square&color=brightgreen
[platform-shield]: https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg?style=flat-square
[platform-link]: #-平台与安装说明

<!-- External links -->
[releases-link]: https://github.com/termlnk/termlnk/releases
[github-issues-link]: https://github.com/termlnk/termlnk/issues
[github-community-link]: https://github.com/termlnk/termlnk/discussions
[trademark-link]: ../TRADEMARK.md
