<div align="center">

<h1>
<img src="screenshots/logo.png" alt="Termlnk" width="64" /><br />
Termlnk
</h1>

개발자를 위한 현대적이고 확장 가능한 스마트 터미널.<br />
**SSH &amp; SFTP &middot; 내장 AI &middot; 코드 스니펫 &middot; 포트 포워딩 &middot; 여러 기기 동기화 &middot; 71개 테마 &middot; 확장 기능 &middot; 크로스 플랫폼.**

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
- [🚀 빠른 시작](#-빠른-시작)
- [💻 플랫폼 및 설치 안내](#-플랫폼-및-설치-안내)
- [🌐 Web 에디션 셀프 호스팅](#-web-에디션-셀프-호스팅)
- [🛠 개발](#-개발)
- [🌐 국제화](#-국제화)
- [📸 스크린샷](#-스크린샷)
- [🤝 기여하기](#-기여하기)
- [💬 커뮤니티](#-커뮤니티)
- [🙏 감사의 말](#-감사의-말)
- [📄 라이선스](#-라이선스)

</details>

## 🌈 주요 특징

Termlnk는 빠른 스마트 터미널, SSH & SFTP 클라이언트, 그리고 명령을 실행할 수 있는 AI 어시스턴트를 하나의 앱에 통합합니다. 데스크톱에 설치해 바로 사용하거나, 자체 백엔드를 배포하여 브라우저에서 열 수도 있습니다.

- 🖥 **모든 터미널을 하나의 창에서 관리** — 로컬 셸과 SSH 세션을 나란히 열 수 있고, 유연하게 분할하며 집중이 필요할 때는 하나의 창을 확대할 수 있습니다. 앱을 종료 후 다시 열면 이전 작업 상태로 자동 복원됩니다.
- 🔐 **서버·키·파일 통합 관리** — 서버를 폴더 구조로 정리하고 비밀번호·키·SSH Agent 로그인과 점프 호스트 접속을 지원합니다. 듀얼 팬 SFTP 브라우저에서 드래그로 파일을 주고받을 수 있으며, 모든 SSH 키와 접속했던 호스트 정보는 키체인 페이지에 모여 있어 관리가 편리합니다.
- 🔀 **포트 포워딩** — 로컬 서비스를 원격에 공개하거나, 원격 서비스를 로컬로 매핑하거나, SSH 연결을 SOCKS5 프록시로 활용할 수 있습니다. 모든 설정은 UI에서 완료되며 원클릭으로 시작·중지할 수 있습니다.
- ✂️ **코드 스니펫(Snippets)** — 자주 쓰는 명령을 저장해 그룹으로 관리하고, 어떤 세션에서든 원클릭으로 실행할 수 있습니다. 특정 서버에 연결하면 자동 실행되도록 설정할 수도 있습니다.
- 🤖 **AI Agent** — OpenAI, Claude, Gemini, DeepSeek, Qwen 및 OpenAI 호환 모델을 자유롭게 전환합니다. 사용자 승인 후 터미널 명령을 실행할 수 있으며, 긴 대화에서도 문맥을 유지합니다.
- ☁️ **여러 기기 동기화, 종단 간 암호화** — 서버, 키, 코드 스니펫, 포트 포워딩 규칙이 여러 기기 사이에서 자동으로 동기화됩니다. 데이터는 기기에서 암호화된 뒤 전송되며, 마스터 비밀번호는 언제든 변경할 수 있고 변경 후에도 기존 데이터를 정상적으로 읽을 수 있습니다.
- 🔄 **자동 업데이트** — 새 버전은 설정에서 원클릭으로 확인·다운로드·설치할 수 있으며, macOS · Windows · Linux를 지원합니다.
- 🧩 **확장 마켓** — 원클릭으로 확장을 설치해 명령·메뉴·사이드 패널·설정 항목을 추가할 수 있고, 개발자는 안정적인 TypeScript API로 자체 확장을 개발할 수 있습니다.
- 🎨 **71개 테마, 사용자 지정도 가능** — 71개의 프리셋 테마와 실시간 미리보기 지원 테마 에디터를 제공합니다. 「Auto / Light / Dark」 모드는 시스템에 맞춰 명암 테마를 자동으로 전환하며, 블러·불투명도·폰트·단축키까지 모두 사용자 지정할 수 있습니다.
- 💻 **크로스 플랫폼 + 오프라인 우선** — macOS(Intel 및 Apple Silicon), Windows, Linux용 네이티브 설치 프로그램을 제공하며, 인터넷 연결 없이도 사용할 수 있습니다.
- 🌐 **브라우저에서도 사용 가능** — 동일한 앱을 Docker 한 줄 명령으로 자체 서버에 배포할 수 있으며, 자동 HTTPS까지 내장되어 있습니다. 이후 브라우저에서 열기만 하면 되고, 사용 경험은 데스크톱 버전과 동일합니다.
- 🏝 **macOS Dynamic Island** — 노치가 있는 Mac에서는 상단 영역에 AI 어시스턴트의 실시간 상태가 표시되며, 시작·완료·승인 대기·오류 사운드도 함께 제공됩니다.

## 🚀 빠른 시작

### 다운로드

macOS, Windows, Linux(x64 및 arm64)용 사전 빌드 설치 프로그램이 [GitHub Releases][releases-link] 페이지에 공개되어 있습니다. 설치 후에는 설정에서 원클릭으로 자동 업데이트할 수 있습니다.

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
pnpm make:mac      # macOS .dmg / .zip (x64 & arm64)
pnpm make:win      # Windows .exe / .msi (x64 & arm64)
pnpm make:linux    # Linux .AppImage / .deb / .rpm (x64 & arm64)
```

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

## 🌐 Web 에디션 셀프 호스팅

**termlnk-web**은 동일한 앱의 셀프 호스팅 버전으로, 브라우저에서 사용할 수 있습니다. 터미널, 서버, AI 어시스턴트, SFTP의 사용 방식은 데스크톱 버전과 완전히 동일하며, 데스크톱 클라이언트를 실행하는 대신 URL로 접속한다는 차이만 있습니다.

> ⚠ **termlnk-web은 신뢰할 수 있는 머신에서만 실행하세요.** 마스터 비밀번호를 보관하며, 서버 접속, AI 호출, 호스트 머신 파일 읽기가 가능하고 데스크톱 버전과 동일한 권한을 가집니다. 보호 없이 공용 인터넷에 노출하지 마세요.

사전 빌드된 멀티 아키텍처 이미지(amd64 / arm64)가 GHCR에 게시되어 있어 monorepo 전체를 clone할 필요가 없습니다.

```bash
cd apps/web

# 원클릭: 강력한 master password 생성 → 이미지 pull → 시작 → 헬스 체크
./install.sh

# 자동 HTTPS(내장 Caddy + Let's Encrypt):
./install.sh --tls termlnk.example.com
```

또는 Docker Compose로 수동 배포:

```bash
cd apps/web
printf '%s' 'choose-a-strong-passphrase' > master_password.secret && chmod 600 master_password.secret
docker compose up -d
```

원클릭 및 수동 배포, 리버스 프록시(Caddy / nginx) 설정, 환경 변수, 데이터 영속화, 업그레이드, 보안 체크리스트는 **[termlnk-web 배포 가이드](../apps/web/README.md)**를 참고하세요.

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

## 🤝 기여하기

기여를 환영합니다. Pull Request를 제출하기 전에 다음을 확인해 주세요:

1. 리포지토리를 Fork하고 기능 브랜치를 생성합니다.
2. 프로젝트의 코드 규칙과 RxJS 리액티브 프로그래밍 규약을 따릅니다.
3. 로컬에서 `pnpm lint`와 `pnpm test`가 모두 통과해야 합니다.
4. `main` 브랜치에 Conventional Commits 규칙(`feat:` / `fix:` / `refactor:` / `chore:` 등)의 제목으로 PR을 제출합니다.

## 💬 커뮤니티

- [GitHub Discussions][github-community-link] — 질문하고 아이디어를 공유하세요.
- [GitHub Issues][github-issues-link] — 버그 제보와 기능 요청.
- [CHANGELOG][changelog-link] — 전체 릴리스 기록.

## 🙏 감사의 말

Termlnk는 훌륭한 오픈소스 프로젝트와 제품들의 어깨 위에 서 있습니다. 다음에 감사드립니다:

- **[Univer](https://github.com/dream-num/univer)** — Termlnk의 아키텍처는 이 훌륭한 오픈소스 프로젝트에서 큰 영감을 받았습니다. 그 깔끔한 플러그인 기반 설계가 우리의 DI, 기여 포인트, 명령 시스템 구조를 형성했습니다.
- **[Alma](https://alma.now)** — Termlnk의 전반적인 미학과 테마 디자인은 이 훌륭한 제품에서 영감을 받았습니다.

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
[changelog-link]: ./CHANGELOG.md
[trademark-link]: ../TRADEMARK.md
