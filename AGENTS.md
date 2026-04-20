# AGENTS.md

## Project Overview

**Termlnk** is a modular, plugin-based **terminal application** built with **Electron + TypeScript + React**.

### Tech Stack

| Category | Technology                              |
|----------|-----------------------------------------|
| Runtime | Node.js >= 22, pnpm >= 10               |
| Frontend | React 19, TanStack Router, Jotai        |
| Desktop | Electron 40, electron-vite              |
| Build | Vite 8, Turborepo, termlnk-cli          |
| Types | TypeScript 6.0 (strict)                 |
| Testing | Vitest + happy-dom                      |
| Styling | Tailwind CSS v4.2.2 (tm: prefix)        |
| DI | @wendellhu/redi 1.1.1                   |
| Reactive | RxJS (peer dependency for all packages) |
| UI | Radix UI                                |
| Themes | Base46 (base_30 + base_16), 71 presets  |
| IPC | tRPC + @janwirth/electron-trpc-link     |
| Database | Drizzle ORM + SQLite (better-sqlite3)   |

---

## Monorepo Structure

Managed with **pnpm workspaces + Turborepo**: **22 library packages + 1 app (with 2 sub-packages) + 1 internal tooling package**.

```
termlnk/
├── packages/              # 22 publishable library packages
│   ├── core/              # Foundation: DI, core services, models, plugin system
│   ├── themes/            # Theme definitions (Base46)
│   ├── themes-ui/         # Theme UI components (picker, editor)
│   ├── design/            # UI component library (Radix UI + Tailwind, 39 components)
│   ├── ui/                # Application UI layer (business components, 15+ services)
│   ├── network/           # HTTP client with interceptor pipeline + WebSocket
│   ├── database/          # Database layer (Drizzle ORM + SQLite)
│   ├── electron/          # Electron common interfaces (IWindowManagerService, IUpdaterService)
│   ├── electron-main/     # Electron main process (window management, auto-update, file I/O)
│   ├── electron-renderer/ # Electron renderer process (tRPC client, header UI, update UI)
│   ├── terminal/          # Terminal core (config, host models, CSI/DCS/OSC parsers, PTY, Shell Integration)
│   ├── terminal-ui/       # Terminal UI (sessions, workspace splits, search, drag-drop, local terminal)
│   ├── rpc/               # RPC base types (Observable utilities, SSH/SFTP/PTY models)
│   ├── rpc-server/        # RPC server (tRPC 14 routers, SSH, SFTP, PTY, AI, Skill)
│   ├── rpc-client/        # RPC client (12 facade services)
│   ├── agent/             # Agent shared contracts (AI, Skill, MCP interfaces, types, DI identifiers)
│   ├── agent-core/        # AI Agent main process (reasoning engine, MCP server/client, Skill management)
│   ├── agent-ui/          # AI Agent renderer UI (chat panel, model selector, settings)
│   ├── extension/         # Extension system (loader, manifest, contribution points, extension API)
│   ├── extension-ui/      # Extension management UI (browse, enable/disable)
│   ├── settings-ui/       # Settings panel UI (9 tabs: appearance, terminal, network, AI, MCP, Skill...)
│   └── sftp-ui/           # SFTP file browser UI (dual-pane layout, file transfer)
├── apps/
│   └── desktop/           # Desktop application (not published)
│       ├── main/          # Main process (6 plugins)
│       └── renderer/      # Renderer process (12 plugins, React app)
├── internal/
│   └── shared/            # Build tools and configs (termlnk-cli, ESLint presets, Vite builder)
└── docs/
```

### Package Dependency Layers

```
Foundation
  @termlnk/core → @termlnk/themes (peer)

Data
  @termlnk/database → core

Communication
  @termlnk/network → core
  @termlnk/rpc → core
  @termlnk/rpc-server → rpc, database, terminal, agent
  @termlnk/rpc-client → rpc, terminal, agent

Electron
  @termlnk/electron → core
  @termlnk/electron-main → electron, rpc-server, terminal, agent
  @termlnk/electron-renderer → electron, rpc-client, ui

UI
  @termlnk/design → (no deps, peer: react)
  @termlnk/ui → core, design, themes
  @termlnk/themes-ui → core, design, themes, ui

Terminal
  @termlnk/terminal → core
  @termlnk/terminal-ui → core, design, rpc, rpc-client, terminal, themes, ui

Agent
  @termlnk/agent → core (pure contracts)
  @termlnk/agent-core → core, agent, database, rpc, terminal
  @termlnk/agent-ui → core, agent, design, rpc-client, ui

Extension
  @termlnk/extension → core, rpc-client
  @termlnk/extension-ui → core, design, extension, rpc-client, ui

Settings / SFTP
  @termlnk/settings-ui → core, design, rpc-client, terminal, themes, themes-ui, ui, agent-ui, agent
  @termlnk/sftp-ui → core, design, rpc, rpc-client, ui
```

**All packages share peer dependency**: `rxjs >= 7.0.0`

Each package has its own `CLAUDE.md` with detailed architecture and API documentation.

---

## Process Architecture

Termlnk uses Electron dual-process architecture with tRPC over IPC:

```
┌──────────────────────────────────────────────────┐
│  Main Process (Node.js)                          │
│  Plugins: Database, RPC, AgentCore,              │
│           RPCServer, Electron, ElectronMain       │
│  Services: SSH, SFTP, PTY, AI Agent, MCP,        │
│  FileTransfer, Extension, Database, Updater      │
└──────────────────┬───────────────────────────────┘
                   │ tRPC over Electron IPC
┌──────────────────┴───────────────────────────────┐
│  Renderer Process (React 19)                     │
│  Plugins: RPC, RPCClient, UI, Electron,          │
│           ElectronRenderer, Terminal, TerminalUI, │
│           SFTPUI, SettingsUI, Extension,         │
│           ExtensionUI, AgentUI                   │
└──────────────────────────────────────────────────┘
```

### tRPC Routers (14)

`ssh`, `sftp`, `host`, `config`, `ai`, `chat`, `mcp`, `mcpRegistry`, `skill`, `pty`, `localFs`, `fileTransfer`, `proxy`, `extension`

---

## Development Commands

### Root Commands

```bash
pnpm build          # Build all library packages
pnpm build:ci       # CI build (100% concurrency)
pnpm typecheck      # Type-check all packages
pnpm test           # Run all tests
pnpm coverage       # Tests with coverage report
pnpm lint           # Lint all code
pnpm lint:fix       # Auto-fix lint issues
pnpm release        # Release version (release-it + conventional-changelog)
```

### Electron App Development

```bash
cd apps/desktop
pnpm dev            # Start Electron dev mode (localhost:5173)
pnpm build          # Build Vite output (main + preload + renderer)
pnpm stage          # Stage output and native modules to build/app/
pnpm pack           # stage + electron-builder --dir (local testing)
pnpm make           # stage + electron-builder (create installers)
pnpm make:mac       # Build macOS installer
pnpm make:win       # Build Windows installer
pnpm make:linux     # Build Linux installer
```

### Single Package Development

```bash
cd packages/core
pnpm build          # Build single package
pnpm test           # Run package tests
pnpm test:watch     # Test watch mode
pnpm lint:types     # Package type-check
```

---

## Git Commit Convention

Git commit messages must follow the Conventional Commit style:

- `fix: xxx`
- `feat: xxx`
- `refactor: xxx`
- `chore: xxx`

Use the format `<type>: <summary>`, with a lowercase type, a colon, and a space.
Avoid non-standard formats such as missing prefixes, uppercase types, or free-form commit titles.

---

## Code Conventions

Based on `@antfu/eslint-config`, heavily customized.

> **Important**: This project uses **DI + RxJS + Command pattern** architecture.
> All new code **must** follow the reactive programming specification in `docs/termlnk-code-style-guide.md`.

### Naming Conventions

| Category | Rule | Example |
|----------|------|---------|
| Interface | Must start with `I` | `ICommandService`, `IThemeService` |
| DI Identifier | Same name as interface (const) | `export const ICommandService = createIdentifier<ICommandService>('...')` |
| Private members | Must start with `_` | `private _configService`, `private readonly _logService` |
| Service class | PascalCase + `Service` suffix | `CommandService`, `ThemeService` |
| Controller class | PascalCase + `Controller` suffix | `TerminalUIController` |
| Plugin class | PascalCase + `Plugin` suffix | `CorePlugin`, `UIPlugin` |
| Plugin name const | UPPER_SNAKE_CASE + `_PLUGIN_NAME` | `TERMINAL_UI_PLUGIN_NAME` |
| Config key const | UPPER_SNAKE_CASE + `_CONFIG_KEY` | `TERMINAL_UI_PLUGIN_CONFIG_KEY` |
| File names | kebab-case or PascalCase | `command.service.ts`, `HostExplorer.tsx` |
| React component files | PascalCase | `TerminalTabBar.tsx`, `HostDialog.tsx` |
| Enums | PascalCase | `LifecycleStages`, `TerminalSessionStatus` |
| Command IDs | `package-name.command.action-description` | `terminal-ui.command.toggle-host-dialog` |

### Code Style

- Indent: 2 spaces
- Quotes: single `'`
- Semicolons: required
- Trailing newline: required
- Arrow functions: always parenthesize `(x) => x`
- **if statements**: must use braces, no single-line form

```typescript
// ✅ Correct: with braces
if (!value) {
  return;
}

// ❌ Wrong: single-line without braces
if (!value) return;
```

### `cn()` Conditional Class Names

Must use object syntax `{ 'class-name': condition }`, not short-circuit `condition && 'class-name'`:

```tsx
// ✅ Correct: object syntax
cn('tm:base-class', {
  'tm:text-blue': isActive,
  'tm:rotate-45': !alwaysOnTop,
})

// ❌ Wrong: short-circuit
cn('tm:base-class', isActive && 'tm:text-blue')
```

Static class names (no conditions) go in a template literal wrapped with `cn()`:

```tsx
// ✅ Correct
className={cn(`
  tm:flex tm:h-[28px] tm:w-[28px] tm:items-center tm:justify-center
  tm:rounded-md tm:text-white tm:transition-colors tm:hover:bg-one-bg
`)}
```

### Import Rules (Enforced by ESLint)

- **No barrel imports**: Import from specific files, not `index.ts`
- **No penetrating imports**: Don't import internal files across packages
- **No self-package imports**: Don't use package name to import within itself
- **Facade files**: Must explicitly declare return types
- **Facade isolation**: No facade imports outside facades, no external imports in facades

### ESLint Custom Rules

| Rule | Purpose |
|------|---------|
| `no-barrel-import` | Prevent circular dependencies |
| `no-penetrating-import` | Enforce layer boundaries |
| `no-external-imports-in-facade` | Facade purity |
| `no-facade-imports-outside-facade` | Facade isolation |
| `no-self-package-imports` | Prevent self-referencing |

---

## RxJS Reactive Programming (Must Follow)

> Full specification: `docs/termlnk-code-style-guide.md` (13 chapters).

### Core Rules

**1. Observable naming (`$` suffix)**

```typescript
private readonly _sessions$ = new BehaviorSubject<ISession[]>([]);
readonly sessions$: Observable<ISession[]> = this._sessions$.asObservable();
get sessions(): ISession[] { return this._sessions$.getValue(); }
```

**2. Never expose Subject directly** - always use `asObservable()`

**3. Subject choice**: `BehaviorSubject` = stateful (current value), `Subject` = pure event stream

**4. Subscription cleanup (pick one)**

```typescript
this.disposeWithMe(observable$.subscribe(handler));              // Disposable subclass
observable$.pipe(takeUntil(this.dispose$)).subscribe(handler);   // RxDisposable subclass
```

**5. Complete all Subjects + clear collections in dispose()**

```typescript
override dispose(): void {
  super.dispose();
  this._xxx$.complete();
  this._map.clear();
}
```

### Architecture Templates

**Service**: Interface (`I` prefix + `Observable<T>`) → Identifier (same-name const) → Implementation (extends `Disposable`)

```typescript
export interface IXxxService { readonly state$: Observable<IState>; doSomething(): void; }
export const IXxxService = createIdentifier<IXxxService>('package.xxx.service');
export class XxxService extends Disposable implements IXxxService { /* ... */ }
```

**Controller**: extends `RxDisposable`, constructor calls `_initCommands / _initShortcuts / _initUI / _initListeners`

**Command ID format**: `<package-name>.<command|mutation|operation>.<kebab-case-action>`

**Interceptor**: `handler(value, context, next)` — call `next()` to pass through, skip to short-circuit

---

## Plugin Config Key Convention

Every plugin owns **exactly one** top-level config key. Runtime (in-memory) config and persisted fields (database) **share the same key**; persisted values live as subKeys on the plugin's `IXxxPluginConfig` interface.

### Core Rules

| Rule | Detail |
|------|--------|
| Key naming | `<plugin-name>.config` (e.g. `electron.config`, `electron-main.config`) |
| Constant name | UPPER_SNAKE_CASE + `_PLUGIN_CONFIG_KEY` (e.g. `ELECTRON_MAIN_PLUGIN_CONFIG_KEY`) |
| Type declaration | `IXxxPluginConfig` interface aggregates all fields (runtime + persisted) |
| Location | `packages/<plugin>/src/controllers/config.schema.ts` or `config/config.ts` |

### Dual-use: Memory and Database share the same key

```typescript
// 1) In-memory runtime config (IConfigService — url/preload/override/etc.)
this._configService.setConfig(ELECTRON_MAIN_PLUGIN_CONFIG_KEY, runtimeConfig);
const cfg = this._configService.getConfig<IElectronMainConfig>(ELECTRON_MAIN_PLUGIN_CONFIG_KEY);

// 2) Persisted fields (ConfigRepository — subKey read/write on configEntity)
await this._configRepository.setField(ELECTRON_MAIN_PLUGIN_CONFIG_KEY, 'mainWindowState', state);
const stored = await this._configRepository.getField<IMainWindowState>(
  ELECTRON_MAIN_PLUGIN_CONFIG_KEY,
  'mainWindowState'
);
```

### Prohibited

- ❌ Creating a separate top-level key for a single persisted field (e.g. `electron-main.main-window-state`)
- ❌ Writing fields not declared on the plugin's `IXxxPluginConfig` interface
- ❌ Reading/writing another plugin's config key — cross-boundary access must go through a Service API

### Adding a new persisted field

1. Add an optional field to `IXxxPluginConfig`: `mainWindowState?: IMainWindowState`
2. Read/write via `ConfigRepository.getField / setField(KEY, 'mainWindowState', ...)`
3. To react to external mutations, subscribe to `ConfigRepository.changed$` and `filter` by the matching `subKey`

### Examples in the codebase

| Plugin | Config Key | Fields (R=runtime, P=persisted) |
|--------|-----------|----------------------------------|
| `@termlnk/electron` | `electron.config` | `override`(R), `appSettings`(P) |
| `@termlnk/electron-main` | `electron-main.config` | `url`/`preload`/`override`(R), `mainWindowState`(P) |

---

## Theme System (Base46)

71 preset themes (56 dark + 15 light) based on [NvChad/base46](https://github.com/NvChad/base46). See `docs/termlnk-base46-theme-specification.md`.

### Background Color Gradient (based on `black`)

```
darker_black  ← black - 6%   (deep accent)
black         ← baseline 0%  (main background)
black2        ← black + 6%   (secondary background)
one_bg        ← black + 10%  (card/panel background) ⭐ common
one_bg2       ← black + 16%  (hover state)
one_bg3       ← black + 22%  (active/focus state)
```

### Foreground Color Gradient

```
grey          ← black + 40%  (disabled text)
grey_fg       ← grey + 10%   (secondary text)
grey_fg2      ← grey + 20%   (normal text)
light_grey    ← grey + 28%   (primary text)
```

### Tailwind CSS Classes

Use `tm:` prefix (Tailwind v4 colon syntax), underscores become hyphens:

```tsx
// ✅ Correct: use base46 colors
<div className="tm:bg-black">           {/* page background */}
<div className="tm:bg-one-bg">          {/* card background */}
<div className="tm:bg-one-bg2">         {/* hover */}
<span className="tm:text-light-grey">   {/* primary text */}
<div className="tm:border-line">        {/* border */}

// ❌ Wrong: hardcoded colors or dark: prefix
<div className="bg-gray-800 text-white">
<div className="dark:bg-gray-800">
```

### Common Semantic Colors

| Purpose | Tailwind Class | Base46 Variable |
|---------|---------------|-----------------|
| Page background | `tm:bg-black` | `black` |
| Card/panel | `tm:bg-one-bg` | `one_bg` |
| Hover background | `tm:bg-one-bg2` | `one_bg2` |
| Active background | `tm:bg-one-bg3` | `one_bg3` |
| Primary text | `tm:text-light-grey` | `light_grey` |
| Secondary text | `tm:text-grey-fg` | `grey_fg` |
| Disabled text | `tm:text-grey` | `grey` |
| Border | `tm:border-line` | `line` |
| Accent | `tm:bg-nord-blue` / `tm:text-blue` | `nord_blue` / `blue` |
| Success | `tm:text-green` | `green` |
| Warning | `tm:text-yellow` | `yellow` |
| Error | `tm:text-red` | `red` |

---

## Build System

### termlnk-cli

```bash
termlnk-cli build [options]
  --skipUMD     Skip UMD build
  --cleanup     Clean output directory
  --nodeFirst   Node.js-first mode
```

**Output**: ESM → `lib/es/`, CJS → `lib/cjs/`, Types → `lib/types/`

### Turborepo

- Task dependencies: `build` depends on `^build`
- Output caching: `dist/**`, `lib/**`
- Concurrency: 30% default, 100% for CI

---

## Dependency Security & Version Overrides

### Version Override Convention

When fixing transitive dependency vulnerabilities or unifying versions, **must** use the `overrides` field in `pnpm-workspace.yaml`. **Do not** use `pnpm.overrides` in `package.json`.

```yaml
# pnpm-workspace.yaml
overrides:
  defu: ^6.1.5
  lodash: ^4.18.0
  '@xmldom/xmldom': ^0.8.12
```

```jsonc
// ❌ Forbidden: pnpm.overrides in package.json
{
  "pnpm": {
    "overrides": { "defu": "^6.1.5" }
  }
}
```

### Security Vulnerability Fix Workflow

1. Check open alerts via `gh api repos/<owner>/<repo>/dependabot/alerts`
2. Distinguish **direct** vs **transitive** dependencies:
   - **Direct** (e.g. electron): upgrade version in `package.json`
   - **Transitive** (e.g. defu, lodash): add minimum safe version to `overrides` in `pnpm-workspace.yaml`
3. Run `pnpm install` to update the lockfile
4. Verify with `pnpm ls <package> --depth=10`

---

## Internationalization

5 supported languages: en-US, zh-CN, zh-TW, ja-JP, ko-KR

UI packages define locale files in `src/locale/`, aggregated by `apps/desktop/renderer/src/components/locales.ts`.

---

## Documentation

| Document | Path | Purpose |
|----------|------|---------|
| RxJS Reactive Style Guide | `docs/termlnk-code-style-guide.md` | **Must read** for writing services/controllers/plugins |
| Base46 Theme Specification | `docs/termlnk-base46-theme-specification.md` | Theme system color definitions |
