<div align="center">

<h1>
<img src="screenshots/logo.png" alt="Termlnk" width="64" /><br />
Termlnk
</h1>

개발자를 위한 현대적이고 확장 가능한 스마트 터미널.<br />
**SSH &amp; SFTP &middot; AI Agent with MCP &middot; 71개 테마 &middot; 플러그인 생태계 &middot; 크로스 플랫폼.**

[English][readme-en-link] | [简体中文][readme-zh-cn-link] | [繁體中文][readme-zh-tw-link] | [日本語][readme-ja-link] | **한국어**

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
<strong>목차</strong>
</summary>

- [🌈 주요 특징](#-주요-특징)
- [✨ 기능](#-기능)
    - [🖥 터미널 및 세션](#-터미널-및-세션)
    - [🔐 SSH 및 SFTP](#-ssh-및-sftp)
    - [🤖 AI Agent](#-ai-agent)
    - [🧩 플러그인 시스템](#-플러그인-시스템)
    - [🎨 테마 시스템](#-테마-시스템)
- [📸 스크린샷](#-스크린샷)
- [🚀 빠른 시작](#-빠른-시작)
- [💻 플랫폼 및 설치 안내](#-플랫폼-및-설치-안내)
- [🛠 개발](#-개발)
- [🌐 국제화](#-국제화)
- [🤝 기여하기](#-기여하기)
- [💬 커뮤니티](#-커뮤니티)
- [📄 라이선스](#-라이선스)

</details>

## 🌈 주요 특징

- 🖥 **크로스 플랫폼 네이티브 터미널** — 로컬 퍼스트, 완전 오프라인 작동, macOS(Intel 및 Apple Silicon), Windows, Linux 지원.
- 🔐 **풀 기능 SSH 클라이언트** — 트리 기반 호스트 탐색기, 키 인증, 프록시 점프, X11 포워딩.
- 🤖 **내장 AI Agent** — 멀티턴 채팅 + MCP 도구 호출, OpenAI, Claude, Gemini, DeepSeek, Qwen 또는 OpenAI 호환 엔드포인트 간 자유 전환.
- 📂 **SFTP 파일 브라우저** — 듀얼 팬 레이아웃, 드래그 앤 드롭 전송, 일괄 작업, 권한 편집기.
- 🎨 **71개의 기본 테마** — NvChad Base46 호환(다크 56 + 라이트 15), 라이브 테마 에디터.
- 🧩 **플러그인 아키텍처** — VS Code 스타일 기여 포인트, 마켓플레이스에서 원클릭 설치.
- 🪟 **워크스페이스 분할** — 재귀 이진 트리 레이아웃, 드래그로 크기 조절, 확대 모드.
- 🔗 **Shell 통합** — OSC 633 명령 추적, 작업 디렉터리 동기화, AI 지원 `terminal_run`.
- 🏝 **Dynamic Island(macOS)** — 노치를 인식하는 AI Agent 세션용 플로팅 상태 오버레이. 세션 시작, 작업 완료, 승인 대기, 오류 등의 이벤트에 커스텀 사운드를 지정할 수 있습니다.
- 🪟 **투명성 및 커스터마이징** — 블러, 불투명도, 폰트, 키바인딩 구성 가능.

## ✨ 기능

### 🖥 터미널 및 세션

- 같은 워크스페이스 안에서 로컬 PTY와 원격 SSH 세션을 함께 사용.
- 재귀 분할 레이아웃: 수평 / 수직 / 확대, 드래그로 크기 조절.
- 풀 xterm.js 렌더링: 리거처, 트루 컬러, Sixel, 이미지 프로토콜.
- 내장 버퍼 검색, 하이퍼링크 감지, IME 입력.
- 재시작 시 세션 복원, 워크스페이스 단위 저장.

### 🔐 SSH 및 SFTP

- 계층적 호스트 트리, 그룹화 / 태그 / 드래그 재정렬 지원.
- 비밀번호, 개인 키, SSH Agent 인증.
- 프록시 점프 체인(`ProxyJump`)과 SOCKS5 프록시.
- X11 포워딩, `trzsz` / `zmodem` 파일 전송.
- 듀얼 팬 SFTP, 전송 대기열, 권한 편집기, 대량 작업.

### 🤖 AI Agent

- Markdown과 코드 하이라이트를 지원하는 채팅 패널.
- MCP(Model Context Protocol) 클라이언트 — 로컬 및 원격 도구 서버에 연결 가능.
- Provider 레지스트리: OpenAI, Anthropic, Google Gemini, DeepSeek, Qwen, OpenAI 호환 엔드포인트.
- `terminal_run` 도구로 사용자 승인 후 선택한 터미널에서 명령 실행.
- Skill의 탐색, 설치 및 세션별 활성화.

### 🧩 플러그인 시스템

- VS Code 스타일 기여 포인트: 명령, 메뉴, UI 파트, 설정.
- 마켓플레이스에서의 탐색, 설치, 활성화, 비활성화 흐름.
- 격리된 플러그인 런타임, 안정적인 TypeScript API 제공.
- 사용자 정의 React 컴포넌트를 임의의 `BuiltInUIPart` 위치에 주입 가능.

### 🎨 테마 시스템

- 71개의 내장 Base46 테마 — 다크 56개, 라이트 15개.
- 요소별 커스터마이징: 터미널, 크롬, 구문 강조.
- 실시간 미리보기 테마 에디터.
- 앱 내 클래스는 Tailwind CSS v4 + `tm:` 콜론 접두사.

## 📸 스크린샷

<table>
<tr>
<td width="25%"><img src="screenshots/workspace.png" alt="워크스페이스" /></td>
<td width="25%"><img src="screenshots/ssh-split.png" alt="SSH 분할" /></td>
<td width="25%"><img src="screenshots/drag-split-screen.png" alt="드래그 분할" /></td>
<td width="25%"><img src="screenshots/terminal-maximize.png" alt="터미널 확대" /></td>
</tr>
<tr>
<td align="center"><b>워크스페이스</b></td>
<td align="center"><b>SSH 분할</b></td>
<td align="center"><b>드래그 분할</b></td>
<td align="center"><b>팬 확대</b></td>
</tr>
<tr>
<td width="25%"><img src="screenshots/agent.png" alt="AI Agent" /></td>
<td width="25%"><img src="screenshots/sftp.png" alt="SFTP" /></td>
<td width="25%"><img src="screenshots/themes.png" alt="테마" /></td>
<td width="25%"><img src="screenshots/transparent.png" alt="투명 창" /></td>
</tr>
<tr>
<td align="center"><b>AI Agent</b></td>
<td align="center"><b>SFTP 브라우저</b></td>
<td align="center"><b>71개 테마</b></td>
<td align="center"><b>투명 창</b></td>
</tr>
</table>

## 🚀 빠른 시작

### 소스에서 빌드

```bash
git clone https://github.com/termlnk/termlnk.git
cd termlnk
pnpm install

cd apps/desktop
pnpm dev
```

### 설치 프로그램 패키징

```bash
cd apps/desktop
pnpm make:mac      # macOS .dmg / .zip
pnpm make:win      # Windows .exe / .msi
pnpm make:linux    # Linux .AppImage / .deb / .rpm
```

> **참고:** 사전 빌드된 바이너리는 아직 배포되지 않았습니다. 준비되는 대로 [GitHub Releases][releases-link] 페이지에 공개됩니다.

## 💻 플랫폼 및 설치 안내

macOS 빌드는 Developer ID 인증서로 서명되어 있지만 Apple의 공증은 받지 않았으므로, 처음 실행할 때 Gatekeeper 경고가 나타날 수 있습니다. Windows와 Linux 빌드는 서명되지 않았습니다.

<details>
<summary>macOS: 첫 실행 시 Gatekeeper 경고</summary>

**옵션 1** — Finder에서 `Termlnk.app`을 마우스 오른쪽 버튼으로 클릭 > 열기 > 확인.

**옵션 2** — 시스템 설정 > 개인 정보 보호 및 보안 > 「보안」 섹션으로 스크롤 > 「확인 없이 열기」 클릭.

**옵션 3** — 터미널에서 실행:

```bash
xattr -cr /Applications/Termlnk.app
```

</details>

<details>
<summary>Windows: SmartScreen이 설치 프로그램을 차단</summary>

**옵션 1** — SmartScreen 대화 상자에서 「추가 정보」를 클릭한 후 「실행」을 클릭.

**옵션 2** — 설정 > 앱 > 앱 고급 설정 > 「앱을 가져올 위치 선택」을 모든 위치로 설정.

</details>

## 🛠 개발

```bash
pnpm build          # 모든 라이브러리 패키지 빌드
pnpm typecheck      # 타입 검사
pnpm test           # 단위 테스트
pnpm coverage       # 테스트 + 커버리지 리포트
pnpm lint           # Lint
pnpm lint:fix       # Lint 문제 자동 수정(라이선스 헤더 자동 주입 포함)
```

## 🌐 국제화

Termlnk는 기본으로 5개 언어를 지원합니다.

| 언어 | 코드 |
| :--- | :--- |
| English | `en-US` |
| 简体中文 | `zh-CN` |
| 繁體中文 | `zh-TW` |
| 日本語 | `ja-JP` |
| 한국어 | `ko-KR` |

새 언어 추가는 [기여 가이드](#-기여하기)를 참고하세요.

## 🤝 기여하기

기여를 환영합니다. Pull Request를 제출하기 전에 다음을 확인해 주세요:

1. 리포지토리를 Fork하고 기능 브랜치를 생성합니다.
2. 프로젝트의 코드 규칙과 RxJS 리액티브 프로그래밍 규약을 따릅니다.
3. 로컬에서 `pnpm lint`와 `pnpm test`가 모두 통과해야 합니다.
4. `main` 브랜치에 Conventional Commits 규칙(`feat:` / `fix:` / `refactor:` / `chore:` 등)의 제목으로 PR을 제출합니다.

## 💬 커뮤니티

- [GitHub Discussions][github-community-link] — 질문하고 아이디어를 공유하세요.
- [GitHub Issues][github-issues-link] — 버그 제보와 기능 요청.

## 📄 라이선스

Copyright © 2026-present Termlnk.

이 프로젝트는 [**PolyForm Noncommercial License 1.0.0**][license-link]을 따릅니다. **상업적 사용은 허용되지 않습니다.** Fork 및 파생 작업물 역시 동일한 라이선스로 오픈소스 및 비상업적으로 배포되어야 합니다.

"Termlnk"라는 이름, 로고 및 기타 Termlnk 표시는 이 프로젝트의 상표입니다. 소스 코드 라이선스는 해당 표시에 대해 **어떠한 권리도 부여하지 않습니다** — 자세한 내용은 [TRADEMARK.md][trademark-link]를 참조하세요.

<!-- Language switcher -->
[readme-en-link]: ../README.md
[readme-zh-cn-link]: ./README.zh-CN.md
[readme-zh-tw-link]: ./README.zh-TW.md
[readme-ja-link]: ./README.ja.md

<!-- Badges -->
[license-shield]: https://img.shields.io/badge/license-PolyForm%20Noncommercial-orange.svg?style=flat-square
[license-link]: ../LICENSE
[release-shield]: https://img.shields.io/github/v/release/termlnk/termlnk?style=flat-square
[downloads-shield]: https://img.shields.io/github/downloads/termlnk/termlnk/total?style=flat-square&color=brightgreen
[platform-shield]: https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg?style=flat-square
[platform-link]: #-플랫폼-및-설치-안내

<!-- External links -->
[releases-link]: https://github.com/termlnk/termlnk/releases
[github-issues-link]: https://github.com/termlnk/termlnk/issues
[github-community-link]: https://github.com/termlnk/termlnk/discussions
[trademark-link]: ../TRADEMARK.md
