<div align="center">

<h1>
<img src="docs/screenshots/logo.png" alt="Termlnk" width="64" /><br />
Termlnk
</h1>

A modern, extensible smart terminal for developers.<br />
**SSH &amp; SFTP &middot; Built-in AI &middot; Snippets &middot; Port forwarding &middot; Cross-device sync &middot; 71 themes &middot; Extensions &middot; Cross-platform.**

**English** | [简体中文][readme-zh-cn-link] | [繁體中文][readme-zh-tw-link] | [日本語][readme-ja-link] | [한국어][readme-ko-link]

[![][license-shield]][license-link]
[![][release-shield]][releases-link]
[![][downloads-shield]][releases-link]
[![][platform-shield]][platform-link]

</div>

---

<p align="center">
  <img src="docs/screenshots/termlnk.png" alt="Termlnk" />
</p>

<details open>
<summary>
<strong>Table of contents</strong>
</summary>

- [🌈 Highlights](#-highlights)
- [🚀 Quick Start](#-quick-start)
- [💻 Platform &amp; Installation Notes](#-platform--installation-notes)
- [🌐 Web Edition (Self-Hosting)](#-web-edition-self-hosting)
- [🛠 Development](#-development)
- [🌐 Internationalization](#-internationalization)
- [📸 Screenshots](#-screenshots)
- [🤝 Contributing](#-contributing)
- [💬 Community](#-community)
- [🙏 Acknowledgements](#-acknowledgements)
- [📄 License](#-license)

</details>

## 🌈 Highlights

Termlnk combines a fast smart terminal, an SSH &amp; SFTP client, and a built-in AI assistant that can execute commands for you — all in one app. Use it on your desktop, or self-host it and open it in any browser.

- 🖥 **All your terminals in one window** — open local shells and SSH sessions side by side, split panes flexibly, magnify a single pane when you need focus, and let Termlnk restore your workspace after a restart.
- 🔐 **Servers, keys and files in one place** — organize servers in a folder tree, log in with a password, key or ssh-agent (jump hosts included), and browse or transfer remote files with a dual-pane SFTP browser. All SSH keys and known hosts are centralized in the keychain page.
- 🔀 **Port forwarding** — expose a local service to a remote server, map a remote service back to your machine, or use any SSH connection as a SOCKS5 proxy. All configured in the UI and toggled with one click.
- ✂️ **Snippets** — save commands you use often, organize them into groups, and run them in any session with a single click. Attach a snippet to a server and it runs the moment you connect.
- 🤖 **AI Agent** — chat with OpenAI, Claude, Gemini, DeepSeek, Qwen or any OpenAI-compatible model, and switch freely between them. With your approval, it can run terminal commands on your behalf and stays coherent during long conversations.
- ☁️ **Cross-device sync, end-to-end encrypted** — servers, keys, snippets and port-forwarding rules sync automatically across your devices. Data is encrypted on your device before it leaves, and your master password can be changed at any time without losing existing data.
- 🔄 **In-app auto-updates** — check, download and install new releases in one click from Settings, on macOS, Windows and Linux.
- 🧩 **Extension marketplace** — install extensions in one click to add commands, menus, side panels or settings. Developers can build custom extensions with a stable TypeScript API.
- 🎨 **71 themes, or bring your own** — pick from 71 built-in themes with a live-preview editor, or set separate light and dark themes and let Termlnk follow the system automatically. Blur, transparency, fonts and keyboard shortcuts are all customizable.
- 💻 **Cross-platform &amp; offline-first** — proper installers for macOS (Intel &amp; Apple Silicon), Windows and Linux. No internet connection required.
- 🌐 **Also runs in a browser** — deploy the same app to your own server with one Docker command, HTTPS included, then use it from any modern browser with the same experience as the desktop.
- 🏝 **Dynamic Island on macOS** — on notch-equipped Macs, the top pill area shows live AI status, complete with sounds for start, completion, approval needed and errors.

## 🚀 Quick Start

### Download

Prebuilt installers for macOS, Windows and Linux (x64 &amp; arm64) are published on the [GitHub Releases][releases-link] page. The desktop app self-updates from Settings once installed.

### Build from source

```bash
git clone https://github.com/termlnk/termlnk.git
cd termlnk
pnpm install

cd apps/desktop
pnpm dev
```

### Package installers

```bash
cd apps/desktop
pnpm make:mac      # macOS .dmg / .zip (x64 & arm64)
pnpm make:win      # Windows .exe / .msi (x64 & arm64)
pnpm make:linux    # Linux .AppImage / .deb / .rpm (x64 & arm64)
```

## 💻 Platform &amp; Installation Notes

macOS builds are code-signed with a Developer ID certificate but not notarized, so Gatekeeper may still prompt on first launch. Windows and Linux builds are unsigned.

<details>
<summary>macOS: Gatekeeper warning on first launch</summary>

**Option 1** — Right-click `Termlnk.app` in Finder > Open > confirm.

**Option 2** — System Settings > Privacy &amp; Security > scroll to Security > click Open Anyway.

**Option 3** — Run in Terminal:

```bash
xattr -cr /Applications/Termlnk.app
```

</details>

<details>
<summary>Windows: SmartScreen blocks the installer</summary>

**Option 1** — Click "More info" on the SmartScreen dialog, then "Run anyway".

**Option 2** — Settings > Apps > Advanced app settings > set App Install Control to allow apps from anywhere.

</details>

## 🌐 Web Edition (Self-Hosting)

**termlnk-web** is a self-hosted version of the same app that runs in the browser. Your terminals, servers, AI assistant and SFTP work exactly as they do on the desktop — the only difference is that you open a URL instead of launching a desktop client.

> ⚠ **Only run termlnk-web on a machine you trust.** It holds your master password and can connect to your servers, invoke AI, and read files on the host machine — it has the same privileges as the desktop app. Do not expose it to the public internet without protection.

Prebuilt multi-arch images (amd64 / arm64) are published to GHCR — no need to clone the monorepo.

```bash
cd apps/web

# One-click: generate a strong master password, pull the image, start, health-check
./install.sh

# With automatic HTTPS (built-in Caddy + Let's Encrypt)
./install.sh --tls termlnk.example.com
```

Or deploy manually with Docker Compose:

```bash
cd apps/web
printf '%s' 'choose-a-strong-passphrase' > master_password.secret && chmod 600 master_password.secret
docker compose up -d
```

See the **[termlnk-web deployment guide](apps/web/README.md)** for one-click &amp; manual deployment, reverse-proxy (Caddy / nginx) configs, environment variables, data persistence, upgrades, and the security checklist.

## 🛠 Development

```bash
pnpm build          # Build all library packages
pnpm typecheck      # Run TypeScript type check
pnpm test           # Run all unit tests
pnpm coverage       # Run tests with coverage report
pnpm lint           # Lint the codebase
pnpm lint:fix       # Auto-fix lint issues (also injects license headers)
```

## 🌐 Internationalization

Termlnk ships with 5 languages out of the box:

| Language | Code |
| :--- | :--- |
| English | `en-US` |
| 简体中文 | `zh-CN` |
| 繁體中文 | `zh-TW` |
| 日本語 | `ja-JP` |
| 한국어 | `ko-KR` |

Help us add new languages by following the [contribution guide](#-contributing).

## 📸 Screenshots

<table>
<tr>
<td width="25%"><img src="docs/screenshots/workspace.png" alt="Workspace" /></td>
<td width="25%"><img src="docs/screenshots/ssh-split.png" alt="SSH split" /></td>
<td width="25%"><img src="docs/screenshots/drag-split-screen.png" alt="Drag to split" /></td>
<td width="25%"><img src="docs/screenshots/terminal-maximize.png" alt="Terminal magnify" /></td>
</tr>
<tr>
<td align="center"><b>Workspace</b></td>
<td align="center"><b>SSH split</b></td>
<td align="center"><b>Drag to split</b></td>
<td align="center"><b>Magnify pane</b></td>
</tr>
<tr>
<td width="25%"><img src="docs/screenshots/agent.png" alt="AI Agent" /></td>
<td width="25%"><img src="docs/screenshots/sftp.png" alt="SFTP" /></td>
<td width="25%"><img src="docs/screenshots/themes.png" alt="Themes" /></td>
<td width="25%"><img src="docs/screenshots/transparent.png" alt="Transparent window" /></td>
</tr>
<tr>
<td align="center"><b>AI Agent</b></td>
<td align="center"><b>SFTP browser</b></td>
<td align="center"><b>71 themes</b></td>
<td align="center"><b>Transparent window</b></td>
</tr>
</table>

## 🤝 Contributing

Contributions are welcome. Before submitting a pull request, please:

1. Fork the repository and create a feature branch.
2. Follow the project's code conventions and RxJS reactive programming style guide.
3. Ensure `pnpm lint` and `pnpm test` pass locally.
4. Submit a PR against `main` with a Conventional Commit title (`feat:`, `fix:`, `refactor:`, `chore:`, ...).

## 💬 Community

- [GitHub Discussions][github-community-link] — ask questions, share ideas.
- [GitHub Issues][github-issues-link] — report bugs and request features.
- [CHANGELOG][changelog-link] — full release history.

## 🙏 Acknowledgements

Termlnk stands on the shoulders of outstanding open-source projects and products. We are grateful to:

- **[Univer](https://github.com/dream-num/univer)** — Termlnk's overall architecture was deeply inspired by this excellent open-source project. Its clean, plugin-driven design shaped how we structured our DI, contribution-point, and command systems.
- **[Alma](https://alma.now)** — The overall aesthetic and theme design of Termlnk draws inspiration from this beautiful product.

## 📄 License

Copyright © 2026-present Termlnk.

Licensed under the [**PolyForm Noncommercial License 1.0.0**][license-link]. **Commercial use is not permitted.** Forks and derivative works must also be open-source and non-commercial, and must be distributed under the same license.

The "Termlnk" name, logo and other Termlnk marks are trademarks of the Termlnk project. The source-code license does NOT grant any rights to the marks — see [TRADEMARK.md][trademark-link] for details.

<!-- Language switcher -->
[readme-zh-cn-link]: ./docs/README.zh-CN.md
[readme-zh-tw-link]: ./docs/README.zh-TW.md
[readme-ja-link]: ./docs/README.ja.md
[readme-ko-link]: ./docs/README.ko.md

<!-- Badges -->
[license-shield]: https://img.shields.io/badge/license-PolyForm%20Noncommercial-orange.svg?style=flat-square
[license-link]: ./LICENSE
[release-shield]: https://img.shields.io/github/v/release/termlnk/termlnk?style=flat-square
[downloads-shield]: https://img.shields.io/github/downloads/termlnk/termlnk/total?style=flat-square&color=brightgreen
[platform-shield]: https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg?style=flat-square
[platform-link]: #-platform--installation-notes

<!-- External links -->
[releases-link]: https://github.com/termlnk/termlnk/releases
[github-issues-link]: https://github.com/termlnk/termlnk/issues
[github-community-link]: https://github.com/termlnk/termlnk/discussions
[changelog-link]: ./docs/CHANGELOG.md
[trademark-link]: ./TRADEMARK.md
