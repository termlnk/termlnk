<div align="center">

<h1>
<img src="docs/screenshots/logo.png" alt="Termlnk" width="64" /><br />
Termlnk
</h1>

A modern, extensible smart terminal for developers.<br />
**SSH &amp; SFTP &middot; AI Agent with MCP &middot; 71 themes &middot; Plugin ecosystem &middot; Cross-platform.**

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

Termlnk packs a fast native terminal, a complete SSH/SFTP client, and a built-in AI agent into a single app — on your desktop, or self-hosted in any browser.

- 🖥 **Terminal &amp; sessions** — local PTY and remote SSH in one workspace, with recursive split / magnify layouts, full xterm.js rendering (ligatures, true color, Sixel, image protocols), buffer search, hyperlinks, IME input, shell integration (OSC 633), and session restore.
- 🔐 **SSH &amp; SFTP** — a hierarchical host tree with password / key / agent auth, `ProxyJump` chains, SOCKS5 and X11 forwarding, plus a dual-pane SFTP browser with transfer queue, `trzsz` / `zmodem`, and a permission editor.
- 🤖 **AI agent** — multi-turn chat with MCP tool servers, swappable across OpenAI, Claude, Gemini, DeepSeek, Qwen or any OpenAI-compatible endpoint, plus an approval-gated `terminal_run` tool and per-session skills.
- 🧩 **Extensions** — VS Code-style contribution points (commands, menus, UI parts, settings) with a one-click marketplace, a stable TypeScript API, and React components injectable into any UI slot.
- 🎨 **Theming &amp; window** — 71 built-in Base46 themes (56 dark, 15 light) with a live editor, plus configurable blur, opacity, fonts, and keybindings.
- 💻 **Cross-platform &amp; offline-first** — a native app for macOS (Intel &amp; Apple Silicon), Windows and Linux that runs fully offline.
- 🌐 **Self-hostable web edition** — the same terminals, SSH, AI agent and SFTP from any browser, via a one-command Docker deploy with built-in Caddy auto-HTTPS.
- 🏝 **Dynamic Island (macOS)** — a notch-aware status overlay for AI agent sessions, with sounds for start, completion, approvals and errors.

## 🚀 Quick Start

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
pnpm make:mac      # macOS .dmg / .zip
pnpm make:win      # Windows .exe / .msi
pnpm make:linux    # Linux .AppImage / .deb / .rpm
```

> **Note:** prebuilt binaries are not published yet. Releases will appear on the [GitHub Releases][releases-link] page once they are available.

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

Beyond the desktop app, Termlnk ships **termlnk-web** — a self-hosted server twin that runs the exact same DI container, business plugins, and vault, with Electron IPC swapped for HTTP + WebSocket. Reach your terminals, hosts, AI agent, SFTP, and skills from any modern browser.

> ⚠ **Run termlnk-web only on a machine you trust.** It holds the vault master key and has the same execution power as the desktop's main process (direct SSH/SFTP, AI inference, local filesystem access). It is *not* a zero-knowledge public backend.

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
[trademark-link]: ./TRADEMARK.md
