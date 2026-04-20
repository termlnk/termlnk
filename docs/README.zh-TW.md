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
- [✨ 功能](#-功能)
    - [🖥 終端與工作階段](#-終端與工作階段)
    - [🔐 SSH 與 SFTP](#-ssh-與-sftp)
    - [🤖 AI Agent](#-ai-agent)
    - [🧩 外掛系統](#-外掛系統)
    - [🎨 主題系統](#-主題系統)
- [📸 螢幕截圖](#-螢幕截圖)
- [🚀 快速開始](#-快速開始)
- [💻 平台與安裝說明](#-平台與安裝說明)
- [🛠 開發](#-開發)
- [🌐 國際化](#-國際化)
- [🤝 貢獻](#-貢獻)
- [💬 社群](#-社群)
- [📄 授權條款](#-授權條款)

</details>

## 🌈 亮點

- 🖥 **跨平台原生終端** — 本機優先，完全離線可用，支援 macOS（Intel 與 Apple Silicon）、Windows、Linux。
- 🔐 **功能完備的 SSH 用戶端** — 樹狀主機瀏覽器、金鑰認證、Proxy Jump、X11 轉發。
- 🤖 **內建 AI Agent** — 多輪對話 + MCP 工具呼叫，可在 OpenAI、Claude、Gemini、DeepSeek、Qwen 或任意 OpenAI 相容端點間自由切換。
- 📂 **SFTP 檔案瀏覽** — 雙面板佈局、拖放傳輸、批次操作、權限編輯。
- 🎨 **71 款開箱主題** — 相容 NvChad Base46（56 深色 + 15 淺色），內建主題編輯器。
- 🧩 **外掛式架構** — 類 VS Code 貢獻點機制，支援外掛市集一鍵安裝。
- 🪟 **工作區分割** — 遞迴二元樹佈局，可拖曳調整，支援放大模式。
- 🔗 **Shell 整合** — OSC 633 命令追蹤、目錄同步、AI 輔助的 `terminal_run`。
- 🏝 **靈動島（macOS）** — 適配瀏海屏的 AI Agent 會話浮動狀態提示，支援會話啟動、任務完成、待審批與錯誤等事件的自訂音效。
- 🪟 **透明與深度自訂** — 可配置模糊、透明度、字型與快捷鍵。

## ✨ 功能

### 🖥 終端與工作階段

- 同一工作區內並存本地 PTY 與遠端 SSH 會話。
- 遞迴分割佈局：水平、垂直、放大，可拖曳調整。
- 完整 xterm.js 渲染：連字、全彩、Sixel、影像協定。
- 內建緩衝區搜尋、超連結偵測、IME 輸入。
- 重新啟動後自動恢復工作階段，可按工作區持久化。

### 🔐 SSH 與 SFTP

- 階層式主機樹，支援分組、標籤、拖曳排序。
- 密碼、私鑰、SSH Agent 驗證。
- Proxy Jump 鏈（`ProxyJump`）與 SOCKS5 代理。
- X11 轉發，`trzsz` / `zmodem` 檔案傳輸。
- 雙面板 SFTP，帶傳輸佇列、權限編輯、批次操作。

### 🤖 AI Agent

- 聊天面板支援 Markdown 與程式碼高亮渲染。
- MCP（Model Context Protocol）用戶端，可連接本地與遠端工具伺服器。
- Provider 註冊表：OpenAI、Anthropic、Google Gemini、DeepSeek、Qwen 或任意 OpenAI 相容端點。
- `terminal_run` 工具讓 Agent 在指定終端中執行命令（需使用者確認）。
- Skill 的探索、安裝與按工作階段啟用。

### 🧩 外掛系統

- 類 VS Code 貢獻點：命令、選單、UI 部件、設定。
- 外掛市集的探索、安裝、啟用、停用流程。
- 隔離的外掛執行階段，提供穩定的 TypeScript API。
- 可將自訂 React 元件注入任意 `BuiltInUIPart` 位置。

### 🎨 主題系統

- 71 款內建 Base46 主題 — 56 深色、15 淺色。
- 分元素自訂：終端、視窗、語法高亮。
- 即時預覽主題編輯器。
- Tailwind CSS v4 + `tm:` colon 前綴於應用內使用。

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

## 🤝 貢獻

歡迎貢獻程式碼。在提交 Pull Request 前請確保：

1. Fork 儲存庫並建立特性分支。
2. 遵守專案程式碼規範與 RxJS 響應式程式設計規範。
3. 本機 `pnpm lint` 與 `pnpm test` 全數通過。
4. 向 `main` 提 PR，標題遵循 Conventional Commits（`feat:` / `fix:` / `refactor:` / `chore:` …）。

## 💬 社群

- [GitHub Discussions][github-community-link] — 提問、交流想法。
- [GitHub Issues][github-issues-link] — 回報 bug、提出功能需求。

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
