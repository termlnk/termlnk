# Desktop v0.3.6

This release makes sessions more reliable, sync more robust, and gives you control over how Termlnk presents itself to the tools running inside it.

## New

- **Configurable terminal identity** — choose which terminal emulator Termlnk announces itself as (`TERM_PROGRAM` and related variables) for local and SSH shells: **Termlnk** (default), **Ghostty**, **Kitty**, or **iTerm2**. Many CLI tools gate inline-image support behind a hardcoded list of terminal names, so they render a text placeholder in Termlnk even though its renderer supports images fine. Announcing a listed terminal lets those images display — honest, since Termlnk implements the Kitty graphics, iTerm2 inline-image, and OSC 8 protocols. Find it under **Settings → Terminal → Terminal Identity**.

## Fixes

- **Auth: idle timeout locks the vault instead of signing out** — after the idle timeout you stay signed in and simply re-enter your passphrase. No more losing your session (and sync state) after stepping away.
- **Auth: session survives transient token-refresh failures** — a flaky network no longer signs you out mid-session.
- **Network: cloud requests now honor your configured proxy** — sign-in, sync, and collab-invite traffic route through the SOCKS5/HTTP proxy configured in Settings, fixing cases where cloud features silently failed behind a proxy.
- **Sync: pull cursor held behind unapplied patch rows** — pending updates are no longer skipped when a patch can't be applied, preventing dropped changes.
- **Sync: guarded against concurrent WebSocket connections** — eliminates a race that could open duplicate sync connections.
- **Linux: build node-pty from source during packaging** — Linux installers no longer ship without the PTY native module, fixing startup failures on systems without prebuilt binaries.
- **Build: deduplicated `@earendil-works` dependencies** — fixes duplicate-type errors in the agent build.

## Install

Grab the installer for your platform from the assets below.

Full changelog: https://github.com/termlnk/termlnk/compare/v0.3.5...v0.3.6
