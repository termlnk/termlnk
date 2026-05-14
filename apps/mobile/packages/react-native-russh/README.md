# @termlnk/react-native-russh

React Native binding for Rust [russh](https://github.com/Eugeny/russh) (SSH client) + [russh-sftp](https://docs.rs/russh-sftp/) (SFTP), exposed to JS through [uniffi-bindgen-react-native](https://github.com/jhugman/uniffi-bindgen-react-native).

Workspace-only. Consumed by `apps/mobile`. Not published to npm.

## Status

🚧 In progress — package skeleton landed in P6.9-2. The TypeScript surface is stable; runtime callables throw `unimplemented` until P6.9-5 wires the ubrn bindings. See `docs/agent/cloud-sync-architecture.md` §8.0 Phase 6 P6.9 for sub-item status.

## API surface

```ts
import { RnRussh } from '@termlnk/react-native-russh';

await RnRussh.uniffiInitAsync();

const conn = await RnRussh.connect({
  host: 'example.com',
  port: 22,
  username: 'me',
  security: { type: 'password', password: '...' },
  onServerKey: async (info) => {
    // TOFU: compare info.fingerprintSha256 against stored value.
    return true;
  },
});

// Shell with a 2 MiB ring buffer + listener replay/live cursor.
const shell = await conn.startShell({ term: 'Xterm256' });
const listenerId = shell.addListener(
  (ev) => {
    if (ev.kind === 'dropped') {
      // ring rolled over between fromSeq..toSeq
    } else {
      // ev is a TerminalChunk
    }
  },
  { cursor: { mode: 'live' } },
);

await shell.sendData(new TextEncoder().encode('ls\r').buffer);

// SFTP on the same SSH connection (channel multiplexed).
const sftp = await conn.startSftp();
const entries = await sftp.list('.');

// Transfers return synchronously so UI can render a Cancel button immediately.
const handle = sftp.upload('/tmp/local.txt', '/srv/remote.txt', {
  onProgress: (p) => console.log(`${p.bytesDone}/${p.total}`),
});
await handle.done; // throws on error / cancel
```

## uniffi-bindgen-react-native pin

Locked to commit `62c91bcce60ca9bbee7269820cc79a9680cb908b` of [`jhugman/uniffi-bindgen-react-native`](https://github.com/jhugman/uniffi-bindgen-react-native). See `CLAUDE.md` for the rationale and upgrade procedure.

## Build

| Platform | Command | Toolchain prerequisites |
|---|---|---|
| iOS | `pnpm --filter @termlnk/react-native-russh build:ios` | Xcode + `rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios` |
| Android | `pnpm --filter @termlnk/react-native-russh build:android` | Android NDK r26+ + `cargo install cargo-ndk` + `rustup target add aarch64-linux-android x86_64-linux-android armv7-linux-androideabi i686-linux-android` |

## License

PolyForm Noncommercial License 1.0.0 — see [`LICENSE`](./LICENSE).
