<div align="center">

<h1>
<img src="screenshots/logo.png" alt="Termlnk" width="64" /><br />
Termlnk
</h1>

為開發者打造的現代化、可擴展智慧終端。<br />
**SSH &amp; SFTP &middot; 內建 AI &middot; 程式碼片段 &middot; 埠轉發 &middot; 多裝置同步 &middot; 71 款主題 &middot; 外掛擴充 &middot; 跨平台。**

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

Termlnk 將一款快速的智慧終端、一個 SSH & SFTP 用戶端、一個可以執行命令的 AI 助手整合在同一個應用中。既可以直接在桌面使用，也可以自行部署後端，從瀏覽器打開。

- 🖥 **所有終端集中在一個視窗** — 本地命令列與 SSH 工作階段可並排開啟，靈活分割，需要專注時可放大單一窗格；關閉軟體後再次開啟，會自動恢復到上次的工作狀態。
- 🔐 **主機、金鑰、檔案統一管理** — 以資料夾結構管理主機，支援密碼、金鑰、SSH Agent 登入，也支援跳板機；雙面板 SFTP 瀏覽器支援拖曳上傳下載；所有 SSH 金鑰與主機指紋都集中在金鑰管理頁面，便於查找與維護。
- 🔀 **埠轉發** — 支援將本機服務開放到遠端、將遠端服務映射回本機，也可以把 SSH 連線當作 SOCKS5 代理使用。所有設定都在介面中完成，一鍵啟停。
- ✂️ **程式碼片段（Snippets）** — 將常用命令儲存並分組管理，在任意工作階段中一鍵執行；綁定到指定主機後，可在連線成功時自動執行。
- 🤖 **AI Agent** — 支援 OpenAI、Claude、Gemini、DeepSeek、Qwen 及任意 OpenAI 相容模型，可自由切換。AI 可在您授權後協助執行終端命令，並在長對話中保持脈絡連貫。
- ☁️ **多裝置同步，端對端加密** — 主機、金鑰、程式碼片段、埠轉發規則可在多台裝置間自動同步；資料在本機加密後才上傳，主密碼可隨時修改，修改後原有資料仍能正常讀取。
- 🔄 **自動更新** — 在設定中一鍵檢查、下載並安裝新版本，涵蓋 macOS、Windows、Linux。
- 🧩 **外掛市集** — 一鍵安裝擴充，可為軟體新增命令、選單、側邊欄或設定項；亦可透過穩定的 TypeScript API 開發自訂外掛。
- 🎨 **71 款主題，亦可自訂** — 內建 71 款主題，並提供支援即時預覽的主題編輯器；「Auto / Light / Dark」模式可跟隨系統自動切換明暗主題；模糊、透明度、字型、快捷鍵均可自訂。
- 💻 **跨平台 + 離線優先** — 面向 macOS（Intel 與 Apple Silicon）、Windows、Linux 提供原生安裝包，完全離線即可使用。
- 🌐 **也可在瀏覽器中使用** — 透過一條 Docker 命令即可將同一款應用部署到您自己的伺服器，內建自動 HTTPS，之後從瀏覽器開啟即可，使用體驗與桌面版一致。
- 🏝 **macOS 靈動島** — 在配備瀏海屏的 Mac 上，頂部會顯示 AI 助手的即時狀態，並附帶啟動、完成、等待確認、錯誤等音效提示。

## 🚀 快速開始

### 下載安裝

macOS、Windows、Linux（x64 與 arm64）的預編譯安裝包已在 [GitHub Releases][releases-link] 發佈。安裝後可在設定中一鍵自動升級。

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
pnpm make:mac      # macOS .dmg / .zip（x64 & arm64）
pnpm make:win      # Windows .exe / .msi（x64 & arm64）
pnpm make:linux    # Linux .AppImage / .deb / .rpm（x64 & arm64）
```

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

**termlnk-web** 是同一款應用的自架版本，可在瀏覽器中使用。終端、主機、AI 助手、SFTP 的使用方式與桌面版完全一致，區別只是透過網址存取，而不是啟動桌面用戶端。

> ⚠ **termlnk-web 只能部署在您信任的機器上。** 它保管著您的主密碼，可連線至您的伺服器、呼叫 AI、讀取本機檔案，與桌面版擁有相同權限。請勿在沒有保護的情況下將其暴露到公網。

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
- [CHANGELOG][changelog-link] — 完整發佈歷史。

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
[changelog-link]: ./CHANGELOG.md
[trademark-link]: ../TRADEMARK.md
