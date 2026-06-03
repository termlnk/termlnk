<div align="center">

<h1>
<img src="screenshots/logo.png" alt="Termlnk" width="64" /><br />
Termlnk
</h1>

為開發者打造的現代化、可擴展智慧終端。<br />
**SSH &amp; SFTP &middot; AI Agent with MCP &middot; 71 款主題 &middot; 外掛生態 &middot; 跨平台。**

[English][readme-en-link] | [简体中文][readme-zh-cn-link] | **繁體中文** | [日本語][readme-ja-link] | [한국어][readme-ko-link]

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
<strong>目錄</strong>
</summary>

- [🌈 亮點](#-亮點)
- [🚀 快速開始](#-快速開始)
- [💻 平台與安裝說明](#-平台與安裝說明)
- [🌐 Web 版自架部署](#-web-版自架部署)
- [🛠 開發](#-開發)
- [🌐 國際化](#-國際化)
- [📸 螢幕截圖](#-螢幕截圖)
- [🤝 貢獻](#-貢獻)
- [💬 社群](#-社群)
- [🙏 致謝](#-致謝)
- [📄 授權條款](#-授權條款)

</details>

## 🌈 亮點

Termlnk 將快速的原生終端、功能完備的 SSH/SFTP 用戶端與內建 AI Agent 整合在單一應用中 —— 既可在桌面執行，也可自架後從任意瀏覽器存取。

- 🖥 **終端與工作階段** — 同一工作區並存本地 PTY 與遠端 SSH，遞迴分割 / 放大佈局，完整 xterm.js 渲染（連字、全彩、Sixel、影像協定），緩衝區搜尋、超連結、IME 輸入、Shell 整合（OSC 633）與工作階段恢復。
- 🔐 **SSH 與 SFTP** — 階層式主機樹，支援密碼 / 金鑰 / SSH Agent 驗證、`ProxyJump` 跳板鏈、SOCKS5 與 X11 轉發，外加雙面板 SFTP 瀏覽器（傳輸佇列、`trzsz` / `zmodem`、權限編輯）。
- 🤖 **AI Agent** — 多輪對話 + MCP 工具伺服器，可在 OpenAI、Claude、Gemini、DeepSeek、Qwen 或任意 OpenAI 相容端點間切換，並提供需使用者確認的 `terminal_run` 工具與按工作階段啟用的 Skill。
- 🧩 **外掛系統** — 類 VS Code 貢獻點（命令、選單、UI 部件、設定），外掛市集一鍵安裝，穩定的 TypeScript API，可將 React 元件注入任意 UI 位置。
- 🎨 **主題與視窗** — 71 款內建 Base46 主題（56 深色、15 淺色）+ 即時預覽編輯器，可配置模糊、透明度、字型與快捷鍵。
- 💻 **跨平台 + 離線優先** — 面向 macOS（Intel 與 Apple Silicon）、Windows、Linux 的原生應用，完全離線可用。
- 🌐 **可自架的 Web 版** — 在任意瀏覽器中使用同一套終端、SSH、AI Agent 與 SFTP，一條命令完成 Docker 部署，內建 Caddy 自動 HTTPS。
- 🏝 **靈動島（macOS）** — 適配瀏海屏的 AI Agent 會話浮動狀態提示，支援啟動、完成、待審批與錯誤音效。

## 🚀 快速開始

### 從原始碼建置

```bash
git clone https://github.com/termlnk/termlnk.git
cd termlnk
pnpm install

cd apps/desktop
pnpm dev
```

### 打包安裝程式

```bash
cd apps/desktop
pnpm make:mac      # macOS .dmg / .zip
pnpm make:win      # Windows .exe / .msi
pnpm make:linux    # Linux .AppImage / .deb / .rpm
```

> **說明：** 預編譯二進位檔尚未發佈。建置產物可用後會出現在 [GitHub Releases][releases-link] 頁面。

## 💻 平台與安裝說明

macOS 建置以 Developer ID 憑證簽章，但未經 Apple 公證，首次啟動時 Gatekeeper 仍可能跳出警告。Windows 與 Linux 建置未簽章。

<details>
<summary>macOS：首次啟動時的 Gatekeeper 警告</summary>

**方案 1** — 在 Finder 中以右鍵點擊 `Termlnk.app` > 打開 > 確認。

**方案 2** — 系統設定 > 隱私權與安全性 > 捲動到「安全性」區塊 > 點擊「強制打開」。

**方案 3** — 在終端機中執行：

```bash
xattr -cr /Applications/Termlnk.app
```

</details>

<details>
<summary>Windows：SmartScreen 封鎖安裝程式</summary>

**方案 1** — 在 SmartScreen 對話框中點擊「其他資訊」，再點擊「仍要執行」。

**方案 2** — 設定 > 應用程式 > 應用程式進階設定 > 將「選擇要從哪裡取得應用程式」設為任何來源。

</details>

## 🌐 Web 版自架部署

除桌面應用外，Termlnk 還提供 **termlnk-web** —— 一個可自架的伺服器孿生版本，執行與桌面端完全相同的 DI 容器、業務外掛與 vault，只是把 Electron IPC 換成了 HTTP + WebSocket。你可以在任意現代瀏覽器中存取自己的終端、主機、AI Agent、SFTP 與 skill。

> ⚠ **termlnk-web 只能部署在你信任的機器上。** 它持有 vault master key，與桌面端主行程擁有相同的執行權限（直連 SSH/SFTP、跑 AI 推理、讀取本機檔案系統），**不是** zero-knowledge 公共後端。

預建置多架構映像（amd64 / arm64）已發佈到 GHCR，無需 clone 整個 monorepo。

```bash
cd apps/web

# 一鍵部署：產生強 master password、拉映像、啟動、健康檢查
./install.sh

# 需要自動 HTTPS（內建 Caddy + Let's Encrypt）：
./install.sh --tls termlnk.example.com
```

或使用 Docker Compose 手動部署：

```bash
cd apps/web
printf '%s' 'choose-a-strong-passphrase' > master_password.secret && chmod 600 master_password.secret
docker compose up -d
```

一鍵與手動部署、反代（Caddy / nginx）設定、環境變數、資料持久化、升級與安全檢查清單，詳見 **[termlnk-web 部署指南](../apps/web/README.md)**。

## 🛠 開發

```bash
pnpm build          # 建置所有函式庫套件
pnpm typecheck      # 型別檢查
pnpm test           # 單元測試
pnpm coverage       # 測試 + 涵蓋率報告
pnpm lint           # Lint
pnpm lint:fix       # 自動修正 lint 問題（同時會注入 license header）
```

## 🌐 國際化

Termlnk 開箱支援 5 種語言：

| 語言 | 代碼 |
| :--- | :--- |
| English | `en-US` |
| 简体中文 | `zh-CN` |
| 繁體中文 | `zh-TW` |
| 日本語 | `ja-JP` |
| 한국어 | `ko-KR` |

按 [貢獻指南](#-貢獻) 參與新語言的添加。

## 📸 螢幕截圖

<table>
<tr>
<td width="25%"><img src="screenshots/workspace.png" alt="工作區" /></td>
<td width="25%"><img src="screenshots/ssh-split.png" alt="SSH 分割" /></td>
<td width="25%"><img src="screenshots/drag-split-screen.png" alt="拖曳分割" /></td>
<td width="25%"><img src="screenshots/terminal-maximize.png" alt="終端放大" /></td>
</tr>
<tr>
<td align="center"><b>工作區</b></td>
<td align="center"><b>SSH 分割</b></td>
<td align="center"><b>拖曳分割</b></td>
<td align="center"><b>窗格放大</b></td>
</tr>
<tr>
<td width="25%"><img src="screenshots/agent.png" alt="AI Agent" /></td>
<td width="25%"><img src="screenshots/sftp.png" alt="SFTP" /></td>
<td width="25%"><img src="screenshots/themes.png" alt="主題" /></td>
<td width="25%"><img src="screenshots/transparent.png" alt="透明視窗" /></td>
</tr>
<tr>
<td align="center"><b>AI Agent</b></td>
<td align="center"><b>SFTP 瀏覽器</b></td>
<td align="center"><b>71 款主題</b></td>
<td align="center"><b>透明視窗</b></td>
</tr>
</table>

## 🤝 貢獻

歡迎貢獻程式碼。在提交 Pull Request 前請確保：

1. Fork 儲存庫並建立特性分支。
2. 遵守專案程式碼規範與 RxJS 響應式程式設計規範。
3. 本機 `pnpm lint` 與 `pnpm test` 全數通過。
4. 向 `main` 提 PR，標題遵循 Conventional Commits（`feat:` / `fix:` / `refactor:` / `chore:` …）。

## 💬 社群

- [GitHub Discussions][github-community-link] — 提問、交流想法。
- [GitHub Issues][github-issues-link] — 回報 bug、提出功能需求。

## 🙏 致謝

Termlnk 站在優秀開源專案與產品的肩膀上。感謝：

- **[Univer](https://github.com/dream-num/univer)** — Termlnk 的整體架構深受這一優秀開源專案的啟發，其清晰的外掛化設計塑造了我們的 DI、貢獻點與命令系統。
- **[Alma](https://alma.now)** — Termlnk 的整體美學與主題設計從這款優秀產品中汲取靈感。

## 📄 授權條款

Copyright © 2026-present Termlnk。

本專案採用 [**PolyForm Noncommercial License 1.0.0**][license-link]。**禁止任何商業用途。** Fork 與衍生作品必須同樣開源且非商業，並以相同授權條款發佈。

"Termlnk" 名稱、Logo 與其他 Termlnk 標識是本專案的商標。原始碼授權條款**不授予**任何商標使用權利——詳見 [TRADEMARK.md][trademark-link]。

<!-- Language switcher -->
[readme-en-link]: ../README.md
[readme-zh-cn-link]: ./README.zh-CN.md
[readme-ja-link]: ./README.ja.md
[readme-ko-link]: ./README.ko.md

<!-- Badges -->
[license-shield]: https://img.shields.io/badge/license-PolyForm%20Noncommercial-orange.svg?style=flat-square
[license-link]: ../LICENSE
[release-shield]: https://img.shields.io/github/v/release/termlnk/termlnk?style=flat-square
[downloads-shield]: https://img.shields.io/github/downloads/termlnk/termlnk/total?style=flat-square&color=brightgreen
[platform-shield]: https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg?style=flat-square
[platform-link]: #-平台與安裝說明

<!-- External links -->
[releases-link]: https://github.com/termlnk/termlnk/releases
[github-issues-link]: https://github.com/termlnk/termlnk/issues
[github-community-link]: https://github.com/termlnk/termlnk/discussions
[trademark-link]: ../TRADEMARK.md
