<div align="center">

<h1>
<img src="screenshots/logo.png" alt="Termlnk" width="64" /><br />
Termlnk
</h1>

開発者のためのモダンで拡張可能なスマートターミナル。<br />
**SSH &amp; SFTP &middot; AI Agent with MCP &middot; 71 テーマ &middot; プラグインエコシステム &middot; クロスプラットフォーム。**

[English][readme-en-link] | [简体中文][readme-zh-cn-link] | [繁體中文][readme-zh-tw-link] | **日本語** | [한국어][readme-ko-link]

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
<strong>目次</strong>
</summary>

- [🌈 ハイライト](#-ハイライト)
- [🚀 クイックスタート](#-クイックスタート)
- [💻 プラットフォームとインストール上の注意](#-プラットフォームとインストール上の注意)
- [🌐 Web 版セルフホスティング](#-web-版セルフホスティング)
- [🛠 開発](#-開発)
- [🌐 国際化](#-国際化)
- [📸 スクリーンショット](#-スクリーンショット)
- [🤝 コントリビュート](#-コントリビュート)
- [💬 コミュニティ](#-コミュニティ)
- [🙏 謝辞](#-謝辞)
- [📄 ライセンス](#-ライセンス)

</details>

## 🌈 ハイライト

Termlnk は、高速なネイティブターミナル、フル機能の SSH/SFTP クライアント、内蔵 AI Agent を 1 つのアプリに統合しています —— デスクトップでも、セルフホストしてブラウザからでも利用できます。

- 🖥 **ターミナルとセッション** — 同一ワークスペースにローカル PTY とリモート SSH を併存。再帰的な分割 / 拡大レイアウト、フル xterm.js レンダリング（リガチャ、トゥルーカラー、Sixel、画像プロトコル）、バッファ検索、ハイパーリンク、IME 入力、Shell 統合（OSC 633）、セッション復元。
- 🔐 **SSH と SFTP** — 階層化ホストツリーとパスワード / 鍵 / SSH Agent 認証、`ProxyJump` チェーン、SOCKS5 と X11 転送、さらに転送キュー・`trzsz` / `zmodem`・パーミッション編集を備えたデュアルペイン SFTP ブラウザ。
- 🤖 **AI Agent** — MCP ツールサーバーを使ったマルチターン対話。OpenAI / Claude / Gemini / DeepSeek / Qwen または OpenAI 互換エンドポイントを切り替え可能。ユーザー承認制の `terminal_run` ツールとセッション単位の Skill も。
- 🧩 **プラグインシステム** — VS Code 風コントリビューションポイント（コマンド、メニュー、UI パーツ、設定）、ワンクリックのマーケットプレイス、安定した TypeScript API、任意の UI 位置に React コンポーネントを注入。
- 🎨 **テーマとウィンドウ** — 71 種類の Base46 テーマ内蔵（ダーク 56、ライト 15）+ ライブプレビューエディタ、ブラー・不透明度・フォント・キーバインドを設定可能。
- 💻 **クロスプラットフォーム + オフラインファースト** — macOS（Intel および Apple Silicon）、Windows、Linux 向けのネイティブアプリで、完全オフラインで動作。
- 🌐 **セルフホスト可能な Web 版** — 同じターミナル / SSH / AI Agent / SFTP をブラウザから。Docker のワンコマンド配置と Caddy 自動 HTTPS を内蔵。
- 🏝 **Dynamic Island（macOS）** — ノッチに対応した AI Agent セッション用の浮動ステータスオーバーレイ。開始・完了・承認・エラーのサウンドに対応。

## 🚀 クイックスタート

### ソースからビルド

```bash
git clone https://github.com/termlnk/termlnk.git
cd termlnk
pnpm install

cd apps/desktop
pnpm dev
```

### インストーラーをパッケージング

```bash
cd apps/desktop
pnpm make:mac      # macOS .dmg / .zip
pnpm make:win      # Windows .exe / .msi
pnpm make:linux    # Linux .AppImage / .deb / .rpm
```

> **注：** ビルド済みバイナリはまだ公開されていません。公開準備が整い次第 [GitHub Releases][releases-link] に掲載されます。

## 💻 プラットフォームとインストール上の注意

macOS 版は Developer ID 証明書で署名されていますが、Apple による公証は受けていないため、初回起動時に Gatekeeper の警告が表示される場合があります。Windows 版と Linux 版は署名されていません。

<details>
<summary>macOS：初回起動時の Gatekeeper 警告</summary>

**方法 1** — Finder で `Termlnk.app` を右クリック > 開く > 確認。

**方法 2** — システム設定 > プライバシーとセキュリティ > 「セキュリティ」までスクロール > 「このまま開く」をクリック。

**方法 3** — ターミナルで実行：

```bash
xattr -cr /Applications/Termlnk.app
```

</details>

<details>
<summary>Windows：SmartScreen がインストーラーをブロックする</summary>

**方法 1** — SmartScreen のダイアログで「詳細情報」をクリックし、続いて「実行」をクリック。

**方法 2** — 設定 > アプリ > アプリの詳細設定 > 「アプリをインストールする場所の選択」を任意のソースに設定。

</details>

## 🌐 Web 版セルフホスティング

デスクトップアプリに加え、Termlnk は **termlnk-web** —— セルフホスト可能なサーバー版を提供します。デスクトップと完全に同じ DI コンテナ・業務プラグイン・vault を実行し、Electron IPC を HTTP + WebSocket に置き換えただけです。あらゆるモダンブラウザから、ターミナル・ホスト・AI Agent・SFTP・スキルにアクセスできます。

> ⚠ **termlnk-web は信頼できるマシンでのみ実行してください。** vault のマスターキーを保持し、デスクトップのメインプロセスと同じ実行権限（SSH/SFTP への直接接続、AI 推論、ローカルファイルシステムへのアクセス）を持ちます。zero-knowledge な公開バックエンドでは **ありません**。

ビルド済みのマルチアーキテクチャイメージ（amd64 / arm64）が GHCR で公開されており、monorepo 全体を clone する必要はありません。

```bash
cd apps/web

# ワンクリック：強力な master password を生成 → イメージ取得 → 起動 → ヘルスチェック
./install.sh

# 自動 HTTPS（内蔵 Caddy + Let's Encrypt）：
./install.sh --tls termlnk.example.com
```

または Docker Compose で手動配置：

```bash
cd apps/web
printf '%s' 'choose-a-strong-passphrase' > master_password.secret && chmod 600 master_password.secret
docker compose up -d
```

ワンクリック / 手動配置、リバースプロキシ（Caddy / nginx）設定、環境変数、データ永続化、アップグレード、セキュリティチェックリストは **[termlnk-web デプロイガイド](../apps/web/README.md)** を参照してください。

## 🛠 開発

```bash
pnpm build          # すべてのライブラリパッケージをビルド
pnpm typecheck      # 型チェック
pnpm test           # ユニットテスト
pnpm coverage       # テスト + カバレッジレポート
pnpm lint           # Lint
pnpm lint:fix       # Lint 問題を自動修正（ライセンスヘッダーの注入も行う）
```

## 🌐 国際化

Termlnk は標準で 5 言語をサポートします。

| 言語 | コード |
| :--- | :--- |
| English | `en-US` |
| 简体中文 | `zh-CN` |
| 繁體中文 | `zh-TW` |
| 日本語 | `ja-JP` |
| 한국어 | `ko-KR` |

新しい言語の追加は [コントリビュートガイド](#-コントリビュート) を参照してください。

## 📸 スクリーンショット

<table>
<tr>
<td width="25%"><img src="screenshots/workspace.png" alt="ワークスペース" /></td>
<td width="25%"><img src="screenshots/ssh-split.png" alt="SSH 分割" /></td>
<td width="25%"><img src="screenshots/drag-split-screen.png" alt="ドラッグ分割" /></td>
<td width="25%"><img src="screenshots/terminal-maximize.png" alt="ターミナル拡大" /></td>
</tr>
<tr>
<td align="center"><b>ワークスペース</b></td>
<td align="center"><b>SSH 分割</b></td>
<td align="center"><b>ドラッグ分割</b></td>
<td align="center"><b>ペイン拡大</b></td>
</tr>
<tr>
<td width="25%"><img src="screenshots/agent.png" alt="AI Agent" /></td>
<td width="25%"><img src="screenshots/sftp.png" alt="SFTP" /></td>
<td width="25%"><img src="screenshots/themes.png" alt="テーマ" /></td>
<td width="25%"><img src="screenshots/transparent.png" alt="透明ウィンドウ" /></td>
</tr>
<tr>
<td align="center"><b>AI Agent</b></td>
<td align="center"><b>SFTP ブラウザ</b></td>
<td align="center"><b>71 テーマ</b></td>
<td align="center"><b>透明ウィンドウ</b></td>
</tr>
</table>

## 🤝 コントリビュート

コントリビュート歓迎です。Pull Request を提出する前に以下を確認してください：

1. リポジトリを Fork し、機能ブランチを作成。
2. プロジェクトのコーディング規約と RxJS リアクティブプログラミング規約に準拠。
3. ローカルで `pnpm lint` と `pnpm test` がすべてパスすること。
4. `main` ブランチに対して Conventional Commits 準拠のタイトル（`feat:` / `fix:` / `refactor:` / `chore:` など）で PR を提出。

## 💬 コミュニティ

- [GitHub Discussions][github-community-link] — 質問・アイデアの共有。
- [GitHub Issues][github-issues-link] — バグ報告・機能要望。

## 🙏 謝辞

Termlnk は優れたオープンソースプロジェクトと製品の上に立っています。以下に感謝します：

- **[Univer](https://github.com/dream-num/univer)** — Termlnk のアーキテクチャ全体はこの優れたオープンソースプロジェクトから大きなインスピレーションを受けています。そのクリーンなプラグイン駆動の設計が、DI・コントリビューションポイント・コマンドシステムの構造を形作りました。
- **[Alma](https://alma.now)** — Termlnk の全体的な美学とテーマデザインはこの優れたプロダクトからインスピレーションを得ています。

## 📄 ライセンス

Copyright © 2026-present Termlnk.

本プロジェクトは [**PolyForm Noncommercial License 1.0.0**][license-link] のもとで提供されます。**商用利用は禁止されています。** Fork と派生作品も同じライセンスで、オープンソースかつ非商用として配布される必要があります。

"Termlnk" の名称、ロゴ、その他の Termlnk マークは本プロジェクトの商標です。ソースコードのライセンスはこれらのマークについて**いかなる権利も付与しません**——詳細は [TRADEMARK.md][trademark-link] を参照。

<!-- Language switcher -->
[readme-en-link]: ../README.md
[readme-zh-cn-link]: ./README.zh-CN.md
[readme-zh-tw-link]: ./README.zh-TW.md
[readme-ko-link]: ./README.ko.md

<!-- Badges -->
[license-shield]: https://img.shields.io/badge/license-PolyForm%20Noncommercial-orange.svg?style=flat-square
[license-link]: ../LICENSE
[release-shield]: https://img.shields.io/github/v/release/termlnk/termlnk?style=flat-square
[downloads-shield]: https://img.shields.io/github/downloads/termlnk/termlnk/total?style=flat-square&color=brightgreen
[platform-shield]: https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg?style=flat-square
[platform-link]: #-プラットフォームとインストール上の注意

<!-- External links -->
[releases-link]: https://github.com/termlnk/termlnk/releases
[github-issues-link]: https://github.com/termlnk/termlnk/issues
[github-community-link]: https://github.com/termlnk/termlnk/discussions
[trademark-link]: ../TRADEMARK.md
