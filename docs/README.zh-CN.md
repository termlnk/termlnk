<div align="center">

<h1>
<img src="screenshots/logo.png" alt="Termlnk" width="64" /><br />
Termlnk
</h1>

为开发者打造的现代化、可扩展智能终端。<br />
**SSH &amp; SFTP &middot; 内置 AI &middot; 常用命令一键跑 &middot; 端口转发 &middot; 多设备同步 &middot; 71 款主题 &middot; 插件扩展 &middot; 全平台。**

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
- [🚀 快速开始](#-快速开始)
- [💻 平台与安装说明](#-平台与安装说明)
- [🌐 Web 版自托管](#-web-版自托管)
- [🛠 开发](#-开发)
- [🌐 国际化](#-国际化)
- [📸 截图](#-截图)
- [🤝 贡献](#-贡献)
- [💬 社区](#-社区)
- [🙏 鸣谢](#-鸣谢)
- [📄 许可证](#-许可证)

</details>

## 🌈 亮点

Termlnk 把一款快速的智能终端、一个 SSH & SFTP 客户端、一个可以执行命令的 AI 助手集成在同一个应用里。既可以直接在桌面使用，也可以自己部署一份后端，从浏览器打开。

- 🖥 **所有终端集中在一个窗口** — 本地命令行与 SSH 会话可以并排打开，灵活分屏，需要专注时可将单个窗格放大；关闭软件后再次打开，可自动恢复到上次的工作状态。
- 🔐 **服务器、密钥、文件统一管理** — 使用文件夹结构管理主机，支持密码、密钥、SSH Agent 登录，也支持跳板机；双面板 SFTP 浏览器支持拖拽上传下载；所有 SSH 密钥与主机指纹集中在密钥管理页面，便于查找与维护。
- 🔀 **端口转发** — 支持将本机服务开放到远端、将远端服务映射回本机，也可以把 SSH 连接当作 SOCKS5 代理使用。所有配置都在界面中完成，一键启停。
- ✂️ **代码片段（Snippets）** — 将常用命令保存并分组管理，在任意会话中一键运行；绑定到指定服务器后，可在连接成功时自动执行。
- 🤖 **AI Agent** — 支持 OpenAI、Claude、Gemini、DeepSeek、Qwen 及任意 OpenAI 兼容模型，可自由切换。AI 可在你授权后帮助执行终端命令，并在长对话中保持上下文连贯。
- ☁️ **多设备同步，端到端加密** — 服务器、密钥、代码片段、端口转发规则可在多台设备间自动同步；数据在本机加密后再上传，主密码可以随时修改，修改后原有数据仍能正常读取。
- 🔄 **自动更新** — 在设置中一键检查、下载并安装新版本，支持 macOS、Windows、Linux。
- 🧩 **插件市场** — 一键安装扩展，可为软件增加命令、菜单、侧边栏或设置项；也可通过稳定的 TypeScript API 开发自定义插件。
- 🎨 **71 款主题，亦可自定义** — 内置 71 款主题，并提供支持实时预览的主题编辑器；「Auto / Light / Dark」模式可跟随系统自动切换明暗主题；模糊、透明度、字体、快捷键均可自定义。
- 💻 **跨平台 + 离线优先** — 面向 macOS（Intel 与 Apple Silicon）、Windows、Linux 提供原生安装包，完全离线即可使用。
- 🌐 **也可在浏览器中使用** — 通过一条 Docker 命令即可将同一款应用部署到你自己的服务器上，自带自动 HTTPS，之后从浏览器访问即可，使用体验与桌面版一致。
- 🏝 **macOS 灵动岛** — 在带有刘海屏的 Mac 上，顶部会展示 AI 助手的实时状态，并附带启动、完成、等待确认、错误等音效提示。

## 🚀 快速开始

### 下载安装

macOS、Windows、Linux（x64 与 arm64）的预编译安装包已在 [GitHub Releases][releases-link] 发布。安装后可在设置中一键自动升级。

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
pnpm make:mac      # macOS .dmg / .zip（x64 & arm64）
pnpm make:win      # Windows .exe / .msi（x64 & arm64）
pnpm make:linux    # Linux .AppImage / .deb / .rpm（x64 & arm64）
```

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

## 🌐 Web 版自托管

**termlnk-web** 是同一款应用的自托管版本，可在浏览器中使用。终端、服务器、AI 助手、SFTP 的使用方式与桌面版完全一致，区别只是通过网址访问而不是启动桌面客户端。

> ⚠ **termlnk-web 只能部署在你信任的机器上。** 它保管着你的主密码，可以连接你的服务器、调用 AI、读取本机文件，与桌面版拥有相同的权限。请勿在没有保护的情况下将其暴露到公网。

预构建多架构镜像（amd64 / arm64）已发布到 GHCR，无需克隆整个 monorepo。

```bash
cd apps/web

# 一键部署：生成强 master password、拉镜像、启动、健康检查
./install.sh

# 需要自动 HTTPS（内置 Caddy + Let's Encrypt）：
./install.sh --tls termlnk.example.com
```

或使用 Docker Compose 手动部署：

```bash
cd apps/web
printf '%s' 'choose-a-strong-passphrase' > master_password.secret && chmod 600 master_password.secret
docker compose up -d
```

一键与手动部署、反代（Caddy / nginx）配置、环境变量、数据持久化、升级与安全清单，详见 **[termlnk-web 部署指南](../apps/web/README.md)**。

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

## 🤝 贡献

欢迎贡献代码。在提交 Pull Request 前请确保：

1. Fork 仓库并创建特性分支。
2. 遵守项目代码规范与 RxJS 响应式编程规范。
3. 本地 `pnpm lint` 与 `pnpm test` 全部通过。
4. 向 `main` 提 PR，标题遵循 Conventional Commits（`feat:` / `fix:` / `refactor:` / `chore:` …）。

## 💬 社区

- [GitHub Discussions][github-community-link] — 提问、交流想法。
- [GitHub Issues][github-issues-link] — 反馈 bug、提功能需求。
- [CHANGELOG][changelog-link] — 完整发布历史。

## 🙏 鸣谢

Termlnk 站在优秀开源项目与产品的肩膀上。感谢：

- **[Univer](https://github.com/dream-num/univer)** — Termlnk 的整体架构深受这一优秀开源项目的启发，其清晰的插件化设计塑造了我们的 DI、贡献点与命令系统。
- **[Alma](https://alma.now)** — Termlnk 的整体美学与主题设计从这款优秀产品中汲取灵感。

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
[changelog-link]: ./CHANGELOG.md
[trademark-link]: ../TRADEMARK.md
