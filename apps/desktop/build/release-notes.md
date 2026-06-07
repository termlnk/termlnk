# [0.2.0](https://github.com/termlnk/termlnk/compare/v0.1.1...v0.2.0) (2026-06-06)

### Bug Fixes

* **ci:** inspect web image by normalized semver tag ([91886f4](https://github.com/termlnk/termlnk/commit/91886f415e7272a20b43ce0b738f0d2badb03d3c))
* **desktop:** emit package-lock.json so electron-builder picks npm collector ([d9e91a0](https://github.com/termlnk/termlnk/commit/d9e91a06e156d42822b7be45ee04fc013b19e16f))
* **desktop:** stub node:diagnostics_channel in renderer for lru-cache ([8ab5a96](https://github.com/termlnk/termlnk/commit/8ab5a96ca3ac03bf5240a4e94b10618282a16c63))
* **desktop:** use explicit `pnpm run` to avoid pnpm 11 builtin clash ([707ffa0](https://github.com/termlnk/termlnk/commit/707ffa0435c7e30876601dd7d0d64feaf090934f))
* disable pnpm 11 verify-deps-before-run to prevent parallel build race ([65b70c0](https://github.com/termlnk/termlnk/commit/65b70c0ac0e5afcc21f2e8442ddb7173d06c12d9))
* package staged desktop app ([136f1cf](https://github.com/termlnk/termlnk/commit/136f1cf68bc49977ff5080a3eea7b7897086d8e9))
* **terminal-ui:** refresh all host tree nodes after a sync burst ([0e6882e](https://github.com/termlnk/termlnk/commit/0e6882e9f500ff369061e1bcf1d52541e5f58e0c))

### Features

* add SSH keychain and known-hosts management ([731d882](https://github.com/termlnk/termlnk/commit/731d8826ba6c7e711c83c284a61573b93a03d3ec))
* align UI chrome with native app conventions ([37896ec](https://github.com/termlnk/termlnk/commit/37896ecabbb8d46ba0728b404eebb872133f3657))
* **electron-renderer:** warm compositor after input to avoid first-frame animation hitch ([1486604](https://github.com/termlnk/termlnk/commit/1486604ec566eb50871244b271008a50a135085e))
* honor OS reduce-motion setting in app and island windows ([7063899](https://github.com/termlnk/termlnk/commit/70638995d723d6ffbcafc02672525b65ebecfd26))
* **island:** always show session count in collapsed pill ([523acb7](https://github.com/termlnk/termlnk/commit/523acb76d829ba94841f38237023dc7522e43862))
* **island:** drive overview height from measured content ([4d6c0e5](https://github.com/termlnk/termlnk/commit/4d6c0e5c4c34ba6dd2dd32d27341d329aae86920))
* **keychain:** allow editing public/private keys and reveal identity password ([859c2ba](https://github.com/termlnk/termlnk/commit/859c2ba47124ba55180e9e5bbc3d75698f37c090))
* **shared-terminal-core:** detach participant on relay peer_left ([be3997e](https://github.com/termlnk/termlnk/commit/be3997e7371c9732bf381a091eb72a7e8e25d355))
* **sync-core:** rebase rejected mutations for local-first conflict resolution ([b3ddf2f](https://github.com/termlnk/termlnk/commit/b3ddf2fa938cdbf366ab3a0da74b373f6680396a))
* **sync:** sync SSH keys, identities and known hosts across devices ([4e72b11](https://github.com/termlnk/termlnk/commit/4e72b1129dec4fe8c34aa3cb1494851e98089ef6))
* **terminal-ui:** redesign SSH host key verification actions ([c1c2669](https://github.com/termlnk/termlnk/commit/c1c2669505f77d573e628dd90a9a12792870ff25))
* **terminal-ui:** warn when a host or identity references a deleted credential ([10f427c](https://github.com/termlnk/termlnk/commit/10f427ccce92832eb0554cd6c473e4e8dff2f429))
* **ui:** add command params and SELECTOR menu items ([7d5130c](https://github.com/termlnk/termlnk/commit/7d5130c87ceea46a8c0ab9eec98048a506294035))
* **ui:** order side-tab-bar buttons and return parts sorted ([b3e8c1d](https://github.com/termlnk/termlnk/commit/b3e8c1d69ba8a042e1e3b9d2417d70bee07a411f))
