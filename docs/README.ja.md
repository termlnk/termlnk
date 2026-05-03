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
- [✨ 機能](#-機能)
    - [🖥 ターミナルとセッション](#-ターミナルとセッション)
    - [🔐 SSH と SFTP](#-ssh-と-sftp)
    - [🤖 AI Agent](#-ai-agent)
    - [🧩 プラグインシステム](#-プラグインシステム)
    - [🎨 テーマシステム](#-テーマシステム)
- [📸 スクリーンショット](#-スクリーンショット)
- [🚀 クイックスタート](#-クイックスタート)
- [💻 プラットフォームとインストール上の注意](#-プラットフォームとインストール上の注意)
- [🛠 開発](#-開発)
- [🌐 国際化](#-国際化)
- [🤝 コントリビュート](#-コントリビュート)
- [💬 コミュニティ](#-コミュニティ)
- [🙏 謝辞](#-謝辞)
- [📄 ライセンス](#-ライセンス)

</details>

## 🌈 ハイライト

- 🖥 **クロスプラットフォームネイティブターミナル** — ローカルファースト、完全オフラインで動作し、macOS（Intel および Apple Silicon）、Windows、Linux をサポート。
- 🔐 **フル機能の SSH クライアント** — ツリー状ホストエクスプローラ、鍵認証、プロキシジャンプ、X11 転送。
- 🤖 **内蔵 AI Agent** — マルチターン対話 + MCP ツール呼び出し、OpenAI / Claude / Gemini / DeepSeek / Qwen または OpenAI 互換エンドポイントを自由に切り替え可能。
- 📂 **SFTP ファイルブラウザ** — デュアルペイン、ドラッグ＆ドロップ転送、バッチ操作、パーミッション編集。
- 🎨 **71 種類のテーマ内蔵** — NvChad Base46 互換（ダーク 56 + ライト 15）、ライブテーマエディタ。
- 🧩 **プラグインアーキテクチャ** — VS Code 風のコントリビューションポイント、マーケットプレイスからワンクリックインストール。
- 🪟 **ワークスペース分割** — 再帰的二分木レイアウト、ドラッグでリサイズ、拡大モード。
- 🔗 **Shell 統合** — OSC 633 コマンド追跡、cwd 同期、AI 支援の `terminal_run`。
- 🏝 **Dynamic Island（macOS）** — ノッチに対応した AI Agent セッション用の浮動ステータスオーバーレイ。セッション開始、タスク完了、承認待ち、エラーなどのイベントにカスタムサウンドを設定可能。
- 🪟 **透明化と細かなカスタマイズ** — ブラー、不透明度、フォント、キーバインドを設定可能。

## ✨ 機能

### 🖥 ターミナルとセッション

- 同一ワークスペース内にローカル PTY とリモート SSH を併存。
- 再帰的分割レイアウト：水平 / 垂直 / 拡大、ドラッグでリサイズ。
- フル xterm.js レンダリング：リガチャ、トゥルーカラー、Sixel、画像プロトコル。
- 内蔵バッファ検索、ハイパーリンク検出、IME 入力。
- 再起動後のセッション復元、ワークスペース単位で永続化。

### 🔐 SSH と SFTP

- 階層化ホストツリー、グループ化、タグ、ドラッグ並べ替え対応。
- パスワード、秘密鍵、SSH Agent 認証。
- プロキシジャンプチェーン（`ProxyJump`）と SOCKS5 プロキシ。
- X11 転送、`trzsz` / `zmodem` ファイル転送。
- デュアルペイン SFTP、転送キュー、パーミッション編集、一括操作。

### 🤖 AI Agent

- Markdown とコードハイライト対応のチャットパネル。
- MCP（Model Context Protocol）クライアント、ローカル・リモートのツールサーバーに接続可能。
- Provider レジストリ：OpenAI、Anthropic、Google Gemini、DeepSeek、Qwen、OpenAI 互換エンドポイント。
- `terminal_run` ツールにより、ユーザー承認のうえ指定ターミナルでコマンドを実行。
- Skill の発見・インストール・セッション単位の有効化。

### 🧩 プラグインシステム

- VS Code 風コントリビューションポイント：コマンド、メニュー、UI パーツ、設定。
- マーケットプレイスでの発見・インストール・有効化・無効化。
- 隔離されたプラグインランタイム、安定した TypeScript API を提供。
- 独自 React コンポーネントを任意の `BuiltInUIPart` にマウント可能。

### 🎨 テーマシステム

- 71 種類の Base46 テーマ内蔵 — ダーク 56、ライト 15。
- 要素別カスタマイズ：ターミナル、クローム、シンタックスハイライト。
- ライブプレビュー付きテーマエディタ。
- アプリ内クラスには Tailwind CSS v4 + `tm:` コロンプレフィックスを使用。

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
