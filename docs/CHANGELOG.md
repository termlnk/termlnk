# Changelog

## [0.3.5](https://github.com/termlnk/termlnk/compare/v0.3.4...v0.3.5) (2026-07-22)

## [0.3.4](https://github.com/termlnk/termlnk/compare/v0.3.3...v0.3.4) (2026-07-08)

## [0.3.3](https://github.com/termlnk/termlnk/compare/v0.3.2...v0.3.3) (2026-07-04)


### Bug Fixes

* **agent-core,shared-terminal-core:** close leaked native resources ([e472a70](https://github.com/termlnk/termlnk/commit/e472a70928d1c5c34bdbf0a30585107e0e11718a))
* **agent-core:** defer assistant message finalization until tool results arrive ([8abeaee](https://github.com/termlnk/termlnk/commit/8abeaee4022bc1b05a3d6b7db7fd6e396bfd9615))
* **auth,sync:** two-phase saga for changePassword→rekey with crash recovery ([6b5e8ba](https://github.com/termlnk/termlnk/commit/6b5e8bac610735d1d4740a5e146aa7ad3c910adf))
* **core,database:** takeAfter source subscription leak + ConfigRepository race ([6a8714c](https://github.com/termlnk/termlnk/commit/6a8714c3dda51229ec01ad38874e9b0210083698))
* **design,sftp-ui:** plug dialog and SFTP splitter memory leaks ([038b415](https://github.com/termlnk/termlnk/commit/038b415e04ed3fe3a8dee1b13b799b5e71210300))
* **eslint:** scope unicorn rules to TypeScript files only ([1c9ef52](https://github.com/termlnk/termlnk/commit/1c9ef52bf6f5b68ab933f001fae8058a5719d0d8))
* improve terminal run background fallback ([040d9a1](https://github.com/termlnk/termlnk/commit/040d9a1678765e3c1d3f9da72b5be7278dcb0758))
* **rpc-server:** SSH session lifecycle — idempotent refcount, close guard, error handling ([2ac94cd](https://github.com/termlnk/termlnk/commit/2ac94cd9fdf82b9d8c711be2ee938a6d9f458050))
* **sync-engine,terminal:** WS transport socket races + CSI buffer limit ([78bfac4](https://github.com/termlnk/termlnk/commit/78bfac4dedfb99b7c57f381dfc70f0d6eb52b75e))
* **terminal-ui:** invalidate xterm font metrics cache on web font load ([e1636b8](https://github.com/termlnk/termlnk/commit/e1636b8b4a5b1bd4b33c2660aedfc6934cbb5cb9))


### Features

* **agent-core:** add context overflow auto-recovery and structured logging ([7c56bb3](https://github.com/termlnk/termlnk/commit/7c56bb3d78de0d013e214ac973fe0a9ffd560009))
* **agent-core:** support iterative compaction with file operation tracking ([b45e267](https://github.com/termlnk/termlnk/commit/b45e267ed059e9b5b7f058df4fe05e786d08f910))
* **auth-ui:** add change password form and account tab integration ([d26edce](https://github.com/termlnk/termlnk/commit/d26edcead1e6c5c23a8173275ec980096544fa94))
* **auth:** add changePassword with SRP verification and sync rekey ([22a9e35](https://github.com/termlnk/termlnk/commit/22a9e35bab277408e178a417ced2a0d11fc1d07e))
* **mobile:** add change password screen ([39df5f2](https://github.com/termlnk/termlnk/commit/39df5f240f49eefa58f49cc69fcee785f0af0c0f))
* **rpc-server:** add promptReached$ observable and flowState to command-block ([a76ee2d](https://github.com/termlnk/termlnk/commit/a76ee2d2276e15d121377493cde8a53ea163af95))
* **rpc-server:** add shell prompt readiness check and Ctrl+C recovery ([94233b5](https://github.com/termlnk/termlnk/commit/94233b50f3e63a7a06b13893c33b38c9e5d14f0c))
* **rpc-server:** auto-create SFTP session from SSH terminal session ([b56eb83](https://github.com/termlnk/termlnk/commit/b56eb83e0ba9221399e1005eaa11214383613df4))
* **settings-ui:** open in-app update dialog on Electron ([c9e9d5f](https://github.com/termlnk/termlnk/commit/c9e9d5f8c59fad5768bbb91384d8784e4972270b))
* **sync:** add rekeyAndResync for post-password-change re-encryption ([6b26533](https://github.com/termlnk/termlnk/commit/6b26533b6268f2fd8de564443a1710e9265b9e9b))
* **sync:** mobile resource parity — 10/10 aligned with desktop ([6bad8bf](https://github.com/termlnk/termlnk/commit/6bad8bfca3c76e1a0bf1a40244ec4719595478de))

## [0.3.2](https://github.com/termlnk/termlnk/compare/v0.3.1...v0.3.2) (2026-06-22)


### Bug Fixes

* **web:** allow non-applied patches so pnpm deploy succeeds in Docker ([3543b61](https://github.com/termlnk/termlnk/commit/3543b619aed6d84ebb3457555c78b766e2216eba))


### Features

* **ci:** allow branch-based Docker builds without a release tag ([94c0000](https://github.com/termlnk/termlnk/commit/94c0000dfbe3ce79e89cb9d93977cfac47525145))
* **themes:** add termlnk-dark and termlnk-light built-in themes ([54eb3bf](https://github.com/termlnk/termlnk/commit/54eb3bf9306d78ac46a7e0f37f13f7da102c2774))
* **web-server:** add demo mode to bypass browser authentication ([20ea8b3](https://github.com/termlnk/termlnk/commit/20ea8b3facc8adf6646774f1f2b9b19cccdad028))
* **web:** add demo mode UI with decorative traffic lights ([32ba1de](https://github.com/termlnk/termlnk/commit/32ba1de9604769f2e519371481c2e909f0281d94))
* **web:** register missing plugins and fix browser compatibility ([d21cf67](https://github.com/termlnk/termlnk/commit/d21cf67bed05344afa62658f701159592ac32dd8))

## [0.3.1](https://github.com/termlnk/termlnk/compare/v0.3.0...v0.3.1) (2026-06-18)


### Bug Fixes

* **docker:** allow non-applied patches in pnpm deploy ([85a0cd5](https://github.com/termlnk/termlnk/commit/85a0cd5ab9aa9fe1e30e2375d7e92ed350c10fbc))
* **snippet-ui, terminal-ui:** refresh tree on group change from dialog ([1b3bf73](https://github.com/termlnk/termlnk/commit/1b3bf73e5a04e787d9b77ffb4e6a007ad692c8fc))
* **terminal-ui:** i18n credential validation error messages in host dialog ([2fc9be2](https://github.com/termlnk/termlnk/commit/2fc9be2083b9a0b781cdd2f395dc9e271f466ca2))


### Features

* **terminal-ui:** preserve cwd when splitting local terminal pane ([a9aa2aa](https://github.com/termlnk/termlnk/commit/a9aa2aa262d001ac417ea672de8498a7ea4fc4f7))

# [0.3.0](https://github.com/termlnk/termlnk/compare/v0.2.1...v0.3.0) (2026-06-17)


### Bug Fixes

* **electron-main:** centralize quit state to unblock close-to-tray install ([fb287d4](https://github.com/termlnk/termlnk/commit/fb287d41d658ebec11406cd84683a3bc80a1eb30))
* **electron-main:** remove hiddenInMissionControl from main window ([f62bafa](https://github.com/termlnk/termlnk/commit/f62bafabfa2e91be82bd87fb7cd311563cf7acbf))
* **mobile:** patch @react-native-menu/menu to support tap inside MenuView ([f15d880](https://github.com/termlnk/termlnk/commit/f15d880c2f143934151032a90dbc7d9f0c7b35e4)), closes [react-native-menu/menu#901](https://github.com/react-native-menu/menu/issues/901)
* **mobile:** remove unnecessary delayLongPress from HostRow ([034a286](https://github.com/termlnk/termlnk/commit/034a2866e54b26f068bd6e19733fc789d39d022f))
* **snippet-ui:** clean up type annotations and remove unused import ([620513c](https://github.com/termlnk/termlnk/commit/620513c862fb45b4e333fefe74e05ba208357777))
* **sync-ui:** add word break to sync error message ([7404a6d](https://github.com/termlnk/termlnk/commit/7404a6d7bcfad403fee511945955174b8e73b663))
* update Tailwind [@source](https://github.com/source) paths after packages-internal migration ([7b850cf](https://github.com/termlnk/termlnk/commit/7b850cf947cdaa76ae1ad888709f2cc06f031b22))
* **vite:** dedupe react to prevent dual-instance hook crash ([22819d7](https://github.com/termlnk/termlnk/commit/22819d793d4d825c76c706e3c9cd28eb4a96c154))


### Features

* **database-mobile:** add port-forwarding-rule entity and repository ([09e3a5a](https://github.com/termlnk/termlnk/commit/09e3a5a3ac979e2763de68a3b215d1e4901a0ca1))
* **database:** add port-forwarding-rule entity and sync repository ([002e85f](https://github.com/termlnk/termlnk/commit/002e85f84b7799b97387dba03fb2780115b2f74c))
* **mobile-ui:** add port forwarding rule management screens ([1e8876c](https://github.com/termlnk/termlnk/commit/1e8876ca09873feb32af2e7d1b73085cbaa00089))
* **mobile:** implement port forwarding tunnel lifecycle management ([44a9655](https://github.com/termlnk/termlnk/commit/44a9655f103ccaa9966274cf29dc4b77bbedc809)), closes [hi#frequency](https://github.com/hi/issues/frequency)
* **mobile:** implement snippet management with database, sync, and UI ([c2fd78f](https://github.com/termlnk/termlnk/commit/c2fd78fe3be02430aa10f0daf9c578eeab5825ae))
* **mobile:** interactive SSH host key TOFU and auth failure dialogs ([673ee65](https://github.com/termlnk/termlnk/commit/673ee65cbf1a1d019fe9f3e3bc16b29c55665a60))
* **mobile:** redesign port forwarding edit and vault screens ([67143db](https://github.com/termlnk/termlnk/commit/67143db85d1e2273aa1937a3438660d83f8f7f59))
* **mobile:** refactor host edit screen with keychain picker ([770e4c2](https://github.com/termlnk/termlnk/commit/770e4c20590d7978d4ccc4bf6a45c0a1c77ee950))
* **mobile:** split key management into generate, import, and edit screens ([4259479](https://github.com/termlnk/termlnk/commit/42594799e4de15334640767ee5bb16561b0a91eb))
* **mobile:** terminal theming, live config switching, and settings redesign ([54feeab](https://github.com/termlnk/termlnk/commit/54feeabce48fcf33c0b42d0ee2cd908cdb13c755))
* **mobile:** wire port forwarding plugin into app bootstrap ([72757dd](https://github.com/termlnk/termlnk/commit/72757dd2e7180643680a058c2437bde91688ecb5))
* **port-forwarding-mobile:** add port forwarding service plugin ([cf2186a](https://github.com/termlnk/termlnk/commit/cf2186a9b3a06fcdbc619e7fc7ccc07dff0fd89a))
* **port-forwarding-ui:** add port forwarding management panel ([1aa9a4a](https://github.com/termlnk/termlnk/commit/1aa9a4a2242d9b0ede6e9f4cd02f2152ae8f0584))
* **react-native-russh:** add TypeScript port forwarding API facade ([b705c89](https://github.com/termlnk/termlnk/commit/b705c8984e003df13298b6a3960e56882b946d2e))
* **react-native-russh:** implement port forwarding tunnels in Rust ([7f1237f](https://github.com/termlnk/termlnk/commit/7f1237f5651d1acced8e5e9523f92aec8b286886))
* **rpc:** add port-forwarding service contract and tRPC router ([2c3ef1d](https://github.com/termlnk/termlnk/commit/2c3ef1d41ec8299257eca6de63af9d4644a27497))
* **snippet:** add snippet system with domain, database, sync, and RPC ([5cfe191](https://github.com/termlnk/termlnk/commit/5cfe191b5a55f61829edeb94a2db96d9fd08e1c7))
* **sync-engine:** add port-forwarding-rule synchroniser ([0a77c9c](https://github.com/termlnk/termlnk/commit/0a77c9c60a5976140992e2e42513a51d855e4ef5))
* **sync-mobile:** register port-forwarding-rule synchroniser ([a92e5fa](https://github.com/termlnk/termlnk/commit/a92e5fa95d5e324f4bececd8496a78571ca14c1b))
* **terminal:** add startup snippet support for SSH host sessions ([ff35954](https://github.com/termlnk/termlnk/commit/ff3595404a14fd72e8b6458a356210c8716c9aaf))
* **ui:** unify explorer backgrounds and refine interaction states ([c4ccecc](https://github.com/termlnk/termlnk/commit/c4cceccd25697b821ba5d2deceb3f101ece9e5f0))

## [0.2.1](https://github.com/termlnk/termlnk/compare/v0.2.0...v0.2.1) (2026-06-07)


### Bug Fixes

* generate current release notes before packaging ([475fe5d](https://github.com/termlnk/termlnk/commit/475fe5d1602ebe8f272ce2c1aaadc7733508b44a))
* harden desktop release packaging ([5a66dad](https://github.com/termlnk/termlnk/commit/5a66dad020565282ed6944e7346416c023129532))

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

## [0.1.1](https://github.com/termlnk/termlnk/compare/v0.1.0...v0.1.1) (2026-06-02)


### Bug Fixes

* **build:** drop unused @swc/plugin-styled-components wasm plugin ([2533607](https://github.com/termlnk/termlnk/commit/2533607bc419763568ab7077bb8ec6074878bb90))
* **deps:** pin rolldown to 1.0.1 and correct workspace dependency declarations ([89a4d8d](https://github.com/termlnk/termlnk/commit/89a4d8d85492b5195cdf51ee4f1919266df33b11))


### Features

* **web-server:** read master password from a secrets file ([20c29f5](https://github.com/termlnk/termlnk/commit/20c29f51eaca26b151b95f20a47e2accc587f042))
* **web:** docker image with caddy TLS profile and multi-arch CI ([3b5f724](https://github.com/termlnk/termlnk/commit/3b5f72403659d2bb5a1f7a8840d4617b35d2cfcc))
* **web:** redesign login gate and add public SEO metadata ([209d81a](https://github.com/termlnk/termlnk/commit/209d81a224d23f7bcc1707e8a6cff69913d3935d))
* **web:** vite SSR bundle and shared-terminal plugins ([aa3ff46](https://github.com/termlnk/termlnk/commit/aa3ff466dde75837b97ee870b20084d58f56f608))

# [0.1.0](https://github.com/termlnk/termlnk/compare/v0.0.2...v0.1.0) (2026-06-02)


* feat(web)!: source master password from env only ([56bef81](https://github.com/termlnk/termlnk/commit/56bef81caa7c5006449de22cde22dd4733fca988))


### Bug Fixes

* **agent-core:** drop deprecated codex_hooks feature flag ([cd4fb27](https://github.com/termlnk/termlnk/commit/cd4fb274f18a4b62198aa32f8be4b490db87e25f))
* **agent-core:** make IKeepAwakeService optional ([c7ff080](https://github.com/termlnk/termlnk/commit/c7ff080b101ce2bdf7cb2d7fc116b6d4a2ef6f6b))
* **agent-core:** store skill paths relative to per-source root ([e53d912](https://github.com/termlnk/termlnk/commit/e53d912037c56eb55b3fde4d86ee0e9e9e91de0a))
* **auth-core, electron-main:** wire IAuthPluginConfig.autoLockIdleMinutes ([e67e54d](https://github.com/termlnk/termlnk/commit/e67e54d27b27f6828df0710f6f8215fc8e7f78fd))
* **auth-core:** idle auto-lock now logs out instead of just zeroing master key ([b8113a1](https://github.com/termlnk/termlnk/commit/b8113a19d39ec0c116cc78eac1e4092d3e42d253))
* **auth-ui:** align logout command id with package namespace ([4e55c07](https://github.com/termlnk/termlnk/commit/4e55c079a38ef8d032633bfed31229a6cadab1b8))
* **auth-ui:** keep focus off the account dialog controls ([4f85a43](https://github.com/termlnk/termlnk/commit/4f85a433d1547deb2ef08b63420fabbdf4116525))
* **core:** prevent leaks after CommandService dispose and in observable-to-subject bridge ([3466794](https://github.com/termlnk/termlnk/commit/3466794b80502cbab7ffb0f41367b57fbaa79b43))
* **database:** vacuum sqlite when the freelist grows bloated ([6912d4f](https://github.com/termlnk/termlnk/commit/6912d4f095cdd8f437b113da422ca4f3a6bc6e4d))
* **deps:** patch transitive security advisories via overrides ([626b344](https://github.com/termlnk/termlnk/commit/626b344904b26833b52ea20fed961abcd2282881))
* handle shared keyboard button clicks ([d8f0d2a](https://github.com/termlnk/termlnk/commit/d8f0d2a7f704fac08cf4af739a7a64c5894f6229))
* **host:** return decrypted host on getInfo and keep existing secrets on edit ([865559c](https://github.com/termlnk/termlnk/commit/865559c0665987def5183680dfc73ebae556ce85))
* **mobile-russh:** correct git repository URL with .git suffix ([dac6631](https://github.com/termlnk/termlnk/commit/dac6631cc43b6083fc0a4198e9ad41e18cfe59d8))
* **mobile-russh:** enable tokio fs feature and verify Rust workspace ([bca666b](https://github.com/termlnk/termlnk/commit/bca666bce30a30510e50ed9588fbe125520f13ee))
* **mobile-russh:** negotiate RSA pubkey signature algorithm and normalize RN newlines ([8e3edca](https://github.com/termlnk/termlnk/commit/8e3edcae3a379050c7fa0ad3cf7f3c095246357b))
* **mobile-ssh:** use SecureStore-safe separator in TOFU key prefix ([c33efea](https://github.com/termlnk/termlnk/commit/c33efead97ffe438dade69f57d1fe02066ab6aa1))
* **mobile:** pin react-native back to the 0.83 line that Expo SDK 55 ships ([6de642a](https://github.com/termlnk/termlnk/commit/6de642a62787e65d1fbf4847889ac91c2f1498f8)), closes [com.facebook.react.bridge.Promise#reject](https://github.com/com.facebook.react.bridge.Promise/issues/reject)
* **mobile:** rename metro.config.js to .cjs for the ES module package ([82e8b91](https://github.com/termlnk/termlnk/commit/82e8b9123f0bb31fad08a861d5e2c99359da9e9f))
* **mobile:** split babel-incompatible param-property decorator in libsodium hasher ([89c1123](https://github.com/termlnk/termlnk/commit/89c1123db46eed3b5128e39c348dc3874b99391d))
* prevent tab drag from portaled overlay clicks ([477d2b0](https://github.com/termlnk/termlnk/commit/477d2b0fe5479782e2cb944698110f7ae7a5cb89))
* **react-native-russh:** bump russh to 0.60.1 to clear pre-auth DoS ([0685891](https://github.com/termlnk/termlnk/commit/06858915749a29197eb382d54b237db084dbf247))
* refresh multiplayer invite links ([58c5678](https://github.com/termlnk/termlnk/commit/58c5678a51b2b3e6e4395206389fe9df64f7eac1))
* release shared keyboard control ([862f957](https://github.com/termlnk/termlnk/commit/862f957359334b4c018d56226d365f37d7eca29b))
* **renderer:** include missing UI packages in Tailwind [@source](https://github.com/source) paths ([0eaaab5](https://github.com/termlnk/termlnk/commit/0eaaab53aeb4eb11b45604f2f3610ca768d1a03b))
* **rpc-server:** cap PTY data ReplaySubject buffer to 64 chunks ([e2e73e9](https://github.com/termlnk/termlnk/commit/e2e73e9939bae10faf8069986e2129d58e6752ce)), closes [hi#throughput](https://github.com/hi/issues/throughput)
* **settings-ui:** render commands bound to multiple keys ([1079fb8](https://github.com/termlnk/termlnk/commit/1079fb87760b9a10c562141e8cdf5b200496131a))
* **shared-terminal-core:** roll back invite row when daemon attach fails ([b74576e](https://github.com/termlnk/termlnk/commit/b74576e8ce92e4be6c003a4fa6dd97249853848b))
* **shared-terminal-ui:** pin participant dialog width and clamp inner overflow ([59da801](https://github.com/termlnk/termlnk/commit/59da8016b7bdb8463c650e181446f127d8e1b563))
* **shared-terminal:** align joiner connectionId with relay 'ready' source ([cb1bc30](https://github.com/termlnk/termlnk/commit/cb1bc30c2be6f226f43143a764165c1da236c48b))
* **shared-terminal:** reject connect when relay closes socket before open ([46cfdf6](https://github.com/termlnk/termlnk/commit/46cfdf6292abb6ea81943115a051bc4be5495355))
* **shared-terminal:** require access token before joining shared session ([edaa98b](https://github.com/termlnk/termlnk/commit/edaa98b1e3d33a55540cea19b4031c225998d1a3))
* **shared-terminal:** tear down joiner sessions when owner ends the share ([2b372c5](https://github.com/termlnk/termlnk/commit/2b372c527da53e365dba7c846ad90eda6207795e))
* show inactive invite join errors ([df99f03](https://github.com/termlnk/termlnk/commit/df99f0384d3bc4225d2fe97802cc05084379be09))
* **sync-core:** exclude built-in skills from sync stream ([0d5e01c](https://github.com/termlnk/termlnk/commit/0d5e01c524642fcda9db877a7dd0c4508ab0117b))
* **sync-core:** honor ISyncPluginConfig.excludedResources at registration ([4a72f8a](https://github.com/termlnk/termlnk/commit/4a72f8a64947fcd5190141379d1374bde15361a2))
* **sync, sync-core:** honor ISyncPluginConfig.autoEnableOnLogin ([0a0d0cb](https://github.com/termlnk/termlnk/commit/0a0d0cb7e302db403b3778c5ebb8494d0a35b83d)), closes [#224d59f](https://github.com/termlnk/termlnk/issues/224d59f)
* **sync:** add idle watchdog to sync WebSocket transport ([9fa4272](https://github.com/termlnk/termlnk/commit/9fa42721100ba3fc139ffcc4c4650b4ed3f7dee7))
* **sync:** hold Syncing through first pull and clear stale errors ([e33c0a9](https://github.com/termlnk/termlnk/commit/e33c0a9138910fb74feea202b8f4416aef946ed8))
* **terminal-ui:** re-fit terminal grid when the web font finishes loading ([8b9e17b](https://github.com/termlnk/termlnk/commit/8b9e17bc05cc9153e98e9de340dedd97027cb386))
* **terminal-ui:** scope multiplayer popover state to active session ([29b6323](https://github.com/termlnk/termlnk/commit/29b6323bac727de61184fec6ee13f1793312bfeb))
* **terminal-ui:** use yellow status dot for closed terminal tab ([35fd095](https://github.com/termlnk/termlnk/commit/35fd095fbaed5212bcecb453ca67f8915dc3c367))
* **tsconfig:** inline experimentalDecorators across all packages ([d916ce0](https://github.com/termlnk/termlnk/commit/d916ce08011dfbb5b4c91e1aa2ababc83e879eae))
* **web-server:** register IWebServerRouterProvider placeholder ([ff8ccb0](https://github.com/termlnk/termlnk/commit/ff8ccb0c5fe5a02a17e81c44822bb1889355421a))
* **web:** normalize cloud base URL to always include /v1 prefix ([8299081](https://github.com/termlnk/termlnk/commit/829908174e62211ce1c935e54e0d1f6c5c2ddf5e))
* **web:** wire locales into Core so LocaleService is initialized ([e80baf9](https://github.com/termlnk/termlnk/commit/e80baf91feec379f3c2e2a7e3a89cf75abc143c2))


### Features

* **agent-ui:** reveal stored AI provider api key in settings ([d4721bd](https://github.com/termlnk/termlnk/commit/d4721bd7ac5b6b57a53895ca8a5ba50573e819d6))
* **auth-core, sync-core, desktop:** wire AuthCore + SyncCore plugins ([5cb6d56](https://github.com/termlnk/termlnk/commit/5cb6d561747354cc7361e095124d6766bcd7ef9a))
* **auth-core, sync-core:** add HttpAuthService and cloudBaseUrl plugin config ([14a94ee](https://github.com/termlnk/termlnk/commit/14a94eeda1c8b8acee83ecb8529e396f9f395bef))
* **auth-core:** add master key derivation primitives ([147f785](https://github.com/termlnk/termlnk/commit/147f785a53e1e15276cced0c2dea0bf3ccc22b6e))
* **auth-core:** hash-wasm hasher, user storage, http auth runtime ([f618f01](https://github.com/termlnk/termlnk/commit/f618f011aecc662f7d6c9665be21012218c3b55e))
* **auth-ui:** add login / register / account components ([e2fe603](https://github.com/termlnk/termlnk/commit/e2fe603d0d2a41cb6a2bedf0a0b9383dab78e4d9))
* **auth-ui:** open account dialog from sidebar button ([1f40fdb](https://github.com/termlnk/termlnk/commit/1f40fdbd1a068e783769695a581985ea3d387056))
* **auth-ui:** redesign AuthGate with tabbed login/register ([0573613](https://github.com/termlnk/termlnk/commit/0573613fa47944d6e0a0af9e55ae572bbf6eab17))
* **auth-ui:** redesign sign-in and account views ([e48c188](https://github.com/termlnk/termlnk/commit/e48c188f7c84e54087acb87c81c9feb78809879f))
* **auth-ui:** surface transport-level errors in AuthGate ([48c9163](https://github.com/termlnk/termlnk/commit/48c9163afbeceb6cd6c21ac5f5016313bbf90a78))
* **auth, auth-core:** add SRP6a client protocol ([e3b3c4d](https://github.com/termlnk/termlnk/commit/e3b3c4dd9ac01e3560486937bf05c64e21a7c9cb))
* **auth, auth-core:** add token storage and auto-refresh manager ([1be3e2a](https://github.com/termlnk/termlnk/commit/1be3e2a3b68f42cfed29ca25d95fc3ff40fb0151))
* **auth, settings-ui:** add device list management ([6962a59](https://github.com/termlnk/termlnk/commit/6962a59039738637971b1858a5651fc0e40444e2))
* **auth, sync:** scaffold contract layer packages ([0d38837](https://github.com/termlnk/termlnk/commit/0d3883705b963277f5e1e42f3a79e745102bdceb))
* **auth:** add Google sign-in and encryption-password vault UI ([afce6bf](https://github.com/termlnk/termlnk/commit/afce6bfdb8ae881d65568327fc49d46dad171fd9))
* **auth:** password-hasher, user-storage, http error contracts ([8128f49](https://github.com/termlnk/termlnk/commit/8128f49327d5eb202aa81f9dcbd688febcb25a80))
* **auth:** persist wrapped master key for restart restore ([b654e68](https://github.com/termlnk/termlnk/commit/b654e688904a44e3a4c29eb3990a16a47b08e9a9))
* **auth:** support Google sign-in and invite deep links in the web shell ([e377076](https://github.com/termlnk/termlnk/commit/e377076582d7a0d1498493c2d1cc402544dac0cc))
* **auth:** surface Google web sign-in errors immediately ([ff4ba4e](https://github.com/termlnk/termlnk/commit/ff4ba4e8fad8cf73b2304c1eb3e7bb36ed8248fb))
* **database, sync-core:** scaffold sync metadata repos and Skill synchroniser ([a67e644](https://github.com/termlnk/termlnk/commit/a67e6446db065a4531c7543b0d8aa57100d09ef2))
* **database:** add sync metadata tables and migration ([79cdd13](https://github.com/termlnk/termlnk/commit/79cdd130080e41c3969b974027415f10028563cc))
* **database:** encrypt sensitive credentials at rest ([74005e6](https://github.com/termlnk/termlnk/commit/74005e60367a6c6eb85cabd580f8c328f92c3816))
* **database:** outbox prefix purge + translate sync table comments ([a0d06bc](https://github.com/termlnk/termlnk/commit/a0d06bc05a2c3274de6492695115cd926e209103))
* **design:** add DialogDragHandle for title-less draggable dialogs ([a6feaf4](https://github.com/termlnk/termlnk/commit/a6feaf4fa100aabfcd037b25057fc48f675aa63a))
* **design:** add modal prop to decouple Dialog mask from Radix focus lock ([df006f4](https://github.com/termlnk/termlnk/commit/df006f46af6bd75379b36ced18629f9fef482195))
* **design:** export LogoIcon brand asset ([2a2408d](https://github.com/termlnk/termlnk/commit/2a2408d96005163e8b3b845c99342f118c71cf2c))
* **desktop, web:** register shared-terminal-ui in renderer apps ([5ed23f9](https://github.com/termlnk/termlnk/commit/5ed23f9102bc9507517b87cf56ffc7aa441f4663))
* **desktop:** cloud endpoint wiring, .env loader, RN-aware core ([ecc46a9](https://github.com/termlnk/termlnk/commit/ecc46a9803c2f60d4a5dd5c227e45f08377c20c0))
* **electron-main:** wire window-focus → SyncService.syncNow trigger ([e9016e9](https://github.com/termlnk/termlnk/commit/e9016e9e1fa619c205d441392dc6eae1a7bfa3c5))
* **electron-renderer:** render update release notes as markdown ([dc31231](https://github.com/termlnk/termlnk/commit/dc312316ec40439b817066cb342de8f18b61c478))
* **mobile-russh:** add ssh_sftp Rust module (russh-sftp + cancel + progress) ([fa6da6c](https://github.com/termlnk/termlnk/commit/fa6da6c9d6f7c5e56930dbbbd0ad26ad9589828f))
* **mobile-russh:** capture Rust panic payloads and add RusshError facade ([fa74d57](https://github.com/termlnk/termlnk/commit/fa74d573b9033f7b5be935305b3d053bfbd1e978))
* **mobile-russh:** commit ubrn-generated Android sources (P6.9-6) ([80f7904](https://github.com/termlnk/termlnk/commit/80f79045e741bffa15c4a677e04982659c8b5c6b))
* **mobile-russh:** port fressh Rust SSH layer (workspace + crates) ([d8717ba](https://github.com/termlnk/termlnk/commit/d8717ba0c4de6f4fb71d8cd8f3d1f0262074f8f5))
* **mobile-russh:** scaffold @termlnk/react-native-russh package skeleton ([277cf64](https://github.com/termlnk/termlnk/commit/277cf647abb274e9c9c97e3de6ad739958da18af))
* **mobile-russh:** wire TS API to ubrn-generated bindings + commit codegen ([b12188f](https://github.com/termlnk/termlnk/commit/b12188f4b49412e81a16485904772b4ff46ed3e0))
* **mobile-sync:** persist pulled hosts into vault and expose hosts$ ([5b98a6b](https://github.com/termlnk/termlnk/commit/5b98a6b77544638d1860d72f0aef2646f1b0a616))
* **mobile:** add encrypted host vault storage layer ([d8c62bb](https://github.com/termlnk/termlnk/commit/d8c62bbbf911a954d72d4d1b0d27fa997081fecc))
* **mobile:** add idle probe + biometric scaffolding (P6.2) ([65c855d](https://github.com/termlnk/termlnk/commit/65c855d65470ad223814597d806c339eddb13bec))
* **mobile:** add recent-sessions repository for the Recent tab ([b3791f7](https://github.com/termlnk/termlnk/commit/b3791f7e4537a8972dab8f3b0887ff857cadcf9e))
* **mobile:** auto-connect terminal/sftp screens from vault credential ([c3c5ca6](https://github.com/termlnk/termlnk/commit/c3c5ca6b2ae76d44e492687f7e853a2018beb70d))
* **mobile:** bootstrap Expo SDK 55 workspace + sync pull-only (P6.1) ([101ce33](https://github.com/termlnk/termlnk/commit/101ce33b0159654f211c5ca8f5c32de05b4cbac0))
* **mobile:** collab invite entrypoint + URL parser (P6.7) ([1372d6c](https://github.com/termlnk/termlnk/commit/1372d6c9e3e4501ae9083cb7fe01e58eb38653b3))
* **mobile:** EAS prebuild rust hook + drop NMSSH/CSSH-Binary remnants ([9fbbaf8](https://github.com/termlnk/termlnk/commit/9fbbaf8d7e7a9913ee23f6792963e1be9e276ed9))
* **mobile:** host detail + terminal webview + sftp + settings UI (P6.6) ([59f92d0](https://github.com/termlnk/termlnk/commit/59f92d02e1871cc9fccbf4af68db28344959ef02))
* **mobile:** introduce tab navigation and host-tree UI ([3048c3a](https://github.com/termlnk/termlnk/commit/3048c3ae224f2a00afc0fc2e8be58a480c633b60))
* **mobile:** push notification registration (P6.8) ([f998b74](https://github.com/termlnk/termlnk/commit/f998b7484112d9fc3c1d990d4e9c1dff813b821f))
* **mobile:** rebuild SSH/SFTP services on @termlnk/react-native-russh (P6.9-7) ([cf3b39e](https://github.com/termlnk/termlnk/commit/cf3b39ec979a806f182ffe4230ffea19095c9b17)), closes [hi#level](https://github.com/hi/issues/level)
* **mobile:** register flow, libsodium hasher, RN-native plugin wiring ([da9f118](https://github.com/termlnk/termlnk/commit/da9f1184216b92a56e28b5b592b2c35499727c28)), closes [#1221](https://github.com/termlnk/termlnk/issues/1221) [#986](https://github.com/termlnk/termlnk/issues/986) [#1092](https://github.com/termlnk/termlnk/issues/1092) [babel/babel#9838](https://github.com/babel/babel/issues/9838)
* **mobile:** SFTP client + system file picker (P6.5) ([1955c5c](https://github.com/termlnk/termlnk/commit/1955c5c284fa75ebca928b8e3c7dc964a037e91d))
* **mobile:** SSH reconnect + tmux/screen resumption (P6.4) ([80c09b6](https://github.com/termlnk/termlnk/commit/80c09b6491328764ec96243858b0b32fce8cf102))
* **mobile:** wire SSH client via @dylankenneally/react-native-ssh-sftp (P6.3) ([2c05649](https://github.com/termlnk/termlnk/commit/2c05649312c930dc379617fb19e583ca26c835a4))
* **network:** inject IFetchProvider for proxy-aware node-side HTTP ([0a46043](https://github.com/termlnk/termlnk/commit/0a460433b18716d969cacc1dbeb6622b41c29926))
* **rpc-server, rpc-client:** wire auth tRPC route + AuthClientService ([77a41fe](https://github.com/termlnk/termlnk/commit/77a41fecac4427907586d501c5be52273e576fcc))
* **rpc, sync-ui, settings-ui:** wire sync IPC bridge + encrypted backup UI ([5a907f7](https://github.com/termlnk/termlnk/commit/5a907f768f6a3752e05db7991c1104c7a3da7c14))
* **rpc:** forward participant input/control and surface joiner ids ([02a9424](https://github.com/termlnk/termlnk/commit/02a94243a53e8284920c06e2289a054150ba02f5))
* **security:** close renderer-side plaintext leaks and encrypt mcp secrets ([291006b](https://github.com/termlnk/termlnk/commit/291006b8c5ec78007a166a9af15e2aee909e65a0))
* **settings-ui:** add Account & Sync tab ([837f1c5](https://github.com/termlnk/termlnk/commit/837f1c5575e958d5b8111290e8c4100b6d6efa7f))
* **settings-ui:** inline-suggest model picker without agent-ui dep ([f2b18c0](https://github.com/termlnk/termlnk/commit/f2b18c007d6b38b7292985112930b90853fe1b0b))
* **sftp-ui, web-renderer:** browser-side SFTP upload/download (P7.6) ([622d25c](https://github.com/termlnk/termlnk/commit/622d25c8dd8fabef8658c4c2c01b3ccc3358dfcd))
* **shared-terminal-core:** add pairing, recording, and relay transport services ([dbeaaa1](https://github.com/termlnk/termlnk/commit/dbeaaa163a02abd61d085d46cd7f77a3ccb7c0ef))
* **shared-terminal-core:** bridge owner PtyMultiplexer to relay via ShareDaemon ([e893c8f](https://github.com/termlnk/termlnk/commit/e893c8fece8ed927bb467f99e5f308028ca8ed1c))
* **shared-terminal-core:** integrate xterm-headless for snapshot fidelity ([cd200d2](https://github.com/termlnk/termlnk/commit/cd200d2ac0339586200c501e2539f192816f8b07))
* **shared-terminal-core:** joiner invite claim, driver input forwarding, heartbeat ([732c655](https://github.com/termlnk/termlnk/commit/732c6559083d8ae6b6a4d57f5a9beced934509e1))
* **shared-terminal-core:** NaCl crypto + frame codec + ring buffer foundation ([72da979](https://github.com/termlnk/termlnk/commit/72da97926972bf1fcc46541d322f478287f7e2e0))
* **shared-terminal-core:** WebRTC mesh transport with composite probe-first strategy ([35672e0](https://github.com/termlnk/termlnk/commit/35672e016a2323cea18259619e48b153fd8629da))
* **shared-terminal-ui:** add shared-terminal management panel ([f3105c7](https://github.com/termlnk/termlnk/commit/f3105c7c6f563e8f4062be7742bf679e7ac9188a))
* **shared-terminal-ui:** collaboration settings cards ([4d899da](https://github.com/termlnk/termlnk/commit/4d899daeeeae8e97f5ff1f419ba552ed3a5c8338))
* **shared-terminal-ui:** driver lock controls + typing indicator ([7e993df](https://github.com/termlnk/termlnk/commit/7e993dfe808b42dfff27f5c1954cbb8c4e6d4a81))
* **shared-terminal-ui:** move joiner driver controls into a tab popover ([324f6b2](https://github.com/termlnk/termlnk/commit/324f6b25c0d56e76a165d988910df0cdbdaa4fb2))
* **shared-terminal-ui:** show driver status dot on multiplayer triggers ([f5d4498](https://github.com/termlnk/termlnk/commit/f5d4498570023d16bb8d035d1e4fe0efb03d1dd2))
* **shared-terminal-ui:** surface join failure inline in participant dialog ([373743f](https://github.com/termlnk/termlnk/commit/373743f473e56a659ca63248ff2e259c7da340ce))
* **shared-terminal-ui:** switch joiner view to xterm with driver controls ([a05739e](https://github.com/termlnk/termlnk/commit/a05739ee0e32a7f269c9783187dfde66bec03c33))
* **shared-terminal-ui:** toast joiner on driver handover ([216258b](https://github.com/termlnk/termlnk/commit/216258b963bbe950c97b4247b4674010061373c6))
* **shared-terminal, shared-terminal-core:** PtyMultiplexer + driver soft-lock ([390f5a4](https://github.com/termlnk/termlnk/commit/390f5a4d9151f070f9732c22d7f1bc0db7e628a4))
* **shared-terminal:** carry daemon X25519 public key in capability ([19279ea](https://github.com/termlnk/termlnk/commit/19279eab87860cf092829377c2723956fa535244))
* **shared-terminal:** contracts for daemon bridge, invite claim, and driver input ([6ed9ba1](https://github.com/termlnk/termlnk/commit/6ed9ba1ceaf9536af444704c4e4085cd84da7344))
* **shared-terminal:** daemon keypair persistence + per-session rekey ([eee94de](https://github.com/termlnk/termlnk/commit/eee94de8cf05b54dc04d7c92d1d5f07398e36686))
* **shared-terminal:** decouple invite URL from relay base ([a6c6bcb](https://github.com/termlnk/termlnk/commit/a6c6bcb15aa0fe8f22ccfe319081eb474878d528))
* **shared-terminal:** derive relayBaseUrl from cloudBaseUrl ([b0863e9](https://github.com/termlnk/termlnk/commit/b0863e99864607480653587ddd968064e761f5f3))
* **shared-terminal:** introduce contract layer for cross-device PTY mirroring ([60c4539](https://github.com/termlnk/termlnk/commit/60c4539a1fd6129d5e0aced725beb8d860ce5a40))
* **shared-terminal:** kick + rekey audit events, mandatory recording UI ([bdc2528](https://github.com/termlnk/termlnk/commit/bdc25282f765910e070885f1d56b4b4f8223abb1))
* **shared-terminal:** multi-session joiner with live owner-title sync ([97e6263](https://github.com/termlnk/termlnk/commit/97e6263ded34cebc83a8959388d34f5d08ef1cb8))
* **shared-terminal:** multiplayer redesign with device pairing and termlnk:// invites ([4ca2e79](https://github.com/termlnk/termlnk/commit/4ca2e79c4feab727f5c85bc720f4f0d04916eecc))
* **shared-terminal:** persist collab invite lifecycle + http transport ([680746f](https://github.com/termlnk/termlnk/commit/680746f7eb2986df5ec1f96cd923dbfd0f837bbf))
* **shared-terminal:** propagate owner-side PTY resize to joiner ([415a30b](https://github.com/termlnk/termlnk/commit/415a30b9de45e4a3965f1f6fdef350583c86c892))
* **shared-terminal:** support view-only mode for shared sessions ([f89c1c5](https://github.com/termlnk/termlnk/commit/f89c1c5592f814469ba39b3e3a1a71dbe1bc7271))
* **shell-integration:** report remote OS/shell/distro via OSC 633;P ([cbcf249](https://github.com/termlnk/termlnk/commit/cbcf2490381da3d5b04b0ea23dc9ebe5b3de2c6a))
* show shared keyboard action loading ([70321b9](https://github.com/termlnk/termlnk/commit/70321b9045d5ecc44559d1f14ce656954316e31e))
* **sync-core, auth-core:** add HTTP transport + token refresher (P3.5) ([ad293fe](https://github.com/termlnk/termlnk/commit/ad293fec2bba8c9aa63e63936ec13da026369746))
* **sync-core, database:** add HostSynchroniser with raw upsert path ([bf42284](https://github.com/termlnk/termlnk/commit/bf42284ef31012f84ce75175be416a54b802235e))
* **sync-core, database:** add outbox queue and persistent client_mut_id allocator ([ee8d64e](https://github.com/termlnk/termlnk/commit/ee8d64ea742b42497d6190fa362f13f0a0b9133e)), closes [hi#water](https://github.com/hi/issues/water)
* **sync-core, renderer:** wire auth→sync bridge + register UI plugins ([31565ed](https://github.com/termlnk/termlnk/commit/31565ed3eb125e51db4d51c943db4cf964d436d6))
* **sync-core:** add ConfigSynchroniser with field-level LWW ([3216e2d](https://github.com/termlnk/termlnk/commit/3216e2dc4f813499520ef9e77abc4f3b0bb45d95))
* **sync-core:** add E2EE crypto service for sync layer ([bb06725](https://github.com/termlnk/termlnk/commit/bb06725c3c46f8de61de67bbd4ff0214ddccf438))
* **sync-core:** add McpSynchroniser ([4bb4788](https://github.com/termlnk/termlnk/commit/4bb4788367b67d68b5e8c83419543c0c4e3ad185))
* **sync-core:** add ProviderSynchroniser for the 3 AI tables ([bac8aad](https://github.com/termlnk/termlnk/commit/bac8aade2138314b87f9dbb64ffc7dc9f42aa9da))
* **sync-core:** add SyncService coordinator ([2de8949](https://github.com/termlnk/termlnk/commit/2de8949c7163e2b420efdaa9edd9189e74c92eff))
* **sync-core:** batch push, initial snapshot, outbox garbage purge ([d0c5a4c](https://github.com/termlnk/termlnk/commit/d0c5a4cd41fa49ba85fb2b07c9eb33d0659f3dfd))
* **sync-ui, auth-ui:** gate BackupCard on auth state + complete 5-language locale ([5516d86](https://github.com/termlnk/termlnk/commit/5516d86a11d3530f5757f6b6c684ae383af696cd))
* **sync-ui, auth-ui:** register architecture §7.3 sync/auth command IDs ([15745c8](https://github.com/termlnk/termlnk/commit/15745c85146d3dc2c034e39db663320fdc303dd1))
* **sync-ui:** add enable/disable Switch to SyncStatusPanel ([224d59f](https://github.com/termlnk/termlnk/commit/224d59f97d94bc2f8b31fecdb027e65e751e7449))
* **sync-ui:** add SyncStatusPanel for cloud sync state ([6f2cd67](https://github.com/termlnk/termlnk/commit/6f2cd67b6deb10e1b7a687746a906be104b05db6))
* **sync, sync-core, database:** add encrypted backup export/import ([63cae3b](https://github.com/termlnk/termlnk/commit/63cae3b50af32baeed89982daf62ef62d6dc15c0))
* **sync:** gate on master-key state and reconcile ghost meta ([69ba2a7](https://github.com/termlnk/termlnk/commit/69ba2a7934f5eeef0f79d333963d08ebba67ed62))
* **sync:** non-syncable config keys, batch size, outbox purge contract ([ace609a](https://github.com/termlnk/termlnk/commit/ace609ab01e6532c2d23fca10e1937c210e24ec3))
* **sync:** persist user enable state across sign-in cycles ([15af91c](https://github.com/termlnk/termlnk/commit/15af91c6bce1d01d888ab59280eb4074bd291b01))
* **terminal-ui:** add split-pane and tab-selection keyboard shortcuts ([fcde7fd](https://github.com/termlnk/termlnk/commit/fcde7fd706f2f0353caffd65d39e89d058e3bb9d))
* **terminal-ui:** show loading state on first copy-link click ([7c34021](https://github.com/termlnk/termlnk/commit/7c340210543ec9ebb9d36cce83113e871586f417))
* **terminal-ui:** surface copy result on multiplayer share button ([5c72cb6](https://github.com/termlnk/termlnk/commit/5c72cb6d45a10f39e1043a77c58c6c966ec3048a))
* **terminal-ui:** toggle keyboard control from the multiplayer popover ([8539a65](https://github.com/termlnk/termlnk/commit/8539a65f3a1ec09b98948380fe3d0946f202fec7))
* **ui, settings-ui, web-renderer:** hide Electron-only settings on web (P7.8) ([5c1a361](https://github.com/termlnk/termlnk/commit/5c1a36137f5b76985afc53be46b86db91ca7ad12))
* **ui:** add a global confirm service ([a4bf79a](https://github.com/termlnk/termlnk/commit/a4bf79a1937342972ae1a6d99f68d6f55a0f5d4f))
* **web-renderer, web/server:** scaffold browser SPA glue + termlnk-web entrypoint (P7.2 + P7.3) ([21e2b8b](https://github.com/termlnk/termlnk/commit/21e2b8b06330703246edc966a0454edf38f93a16))
* **web-renderer:** add WebHeader for browser shell ([079e3ef](https://github.com/termlnk/termlnk/commit/079e3efa33a147aa67396262302517fdaf60c048))
* **web-server, web/renderer:** cookie-gated tRPC + browser login shell (P7.5) ([7547e89](https://github.com/termlnk/termlnk/commit/7547e89848a79b6eefe8241348eccaf55be08615))
* **web-server:** add tRPC WebSocket subscription adapter (P7.1b) ([4274ffd](https://github.com/termlnk/termlnk/commit/4274ffd7b0dd1256b5a0413614f8a6ff55fd412e))
* **web-server:** browser-less master password handshake (P7.1c) ([61f5d0c](https://github.com/termlnk/termlnk/commit/61f5d0ca295d9d560412caca098011dce8d71459))
* **web-server:** scaffold @termlnk/web-server with tRPC standalone HTTP + static SPA (P7.1a) ([2113539](https://github.com/termlnk/termlnk/commit/21135396d05d1e3faf0a7607e51c3b3cf5332299))
* **web, sync-core:** in-memory vault sync for browser (P7.2) ([ce66e5c](https://github.com/termlnk/termlnk/commit/ce66e5c0a27aa465f047cd6152e790d375c4bbe4))
* **web/renderer:** wire full SPA entry mirroring desktop renderer (P7.4) ([525a858](https://github.com/termlnk/termlnk/commit/525a8583026af56c366aaad71f340e29138bace6))
* **web/server:** run dev/start through vite/module-runner ([a1ccf6c](https://github.com/termlnk/termlnk/commit/a1ccf6c3edc05f83150bb51dd59da8b94d7d0d5a))
* **web:** scaffold apps/web SPA with browser-side auth wiring (P7.1) ([f83f585](https://github.com/termlnk/termlnk/commit/f83f5856e5e4cc168ae41da07c1456c845d5fd2e))
* **web:** server platform adapter for device name provider ([cea74dd](https://github.com/termlnk/termlnk/commit/cea74ddcc845c8c40ea49b3d0a0bef2b3a9673a8))


### BREAKING CHANGES

* deployers using `TERMLNK_MASTER_PASSWORD_FILE` or the
docker `secrets.master_password` mount must migrate to the env var.

## [0.0.2](https://github.com/termlnk/termlnk/compare/v0.0.1...v0.0.2) (2026-05-07)


### Bug Fixes

* publish linux per-arch update manifest directly to R2 ([d2ca17f](https://github.com/termlnk/termlnk/commit/d2ca17ff2e58ac6e0c4116018ac45ad98e6c62c7))
* replace yq with js-yaml node script for manifest merge ([107bff5](https://github.com/termlnk/termlnk/commit/107bff5601bd3daf49504725fb9de920007f8b9c))
* track agent process pid ([58ce40a](https://github.com/termlnk/termlnk/commit/58ce40a6903856e400cfae4fd186e2e1241eccbd))


### Features

* add focusWindow api to window manager ([920711f](https://github.com/termlnk/termlnk/commit/920711fcec2bcfa3a44acf9cd67df65bdb6d49ad))
* enforce single-instance lock on app startup ([6c2db27](https://github.com/termlnk/termlnk/commit/6c2db27431dd605775826f1a975eb77f47de8529))
* support host chain (jump hosts) for SSH and SFTP ([6c0003b](https://github.com/termlnk/termlnk/commit/6c0003b7168b17af34edd124af8cb2e769b8ef19))

## 0.0.1 (2026-05-05)


### Bug Fixes

* **agent-core:** block SSRF to private/loopback/metadata in web_fetch ([7587010](https://github.com/termlnk/termlnk/commit/7587010aead9d5ea36c0eaf745bb56d5a6fb8853))
* **agent-core:** correct opencode plugin handler names ([a47e21e](https://github.com/termlnk/termlnk/commit/a47e21e6bbdd7d50ea6c926cd5f92ae8f415cd52))
* **agent-core:** drop unsupported async flag on codex/kimi hook adapters ([557b6a3](https://github.com/termlnk/termlnk/commit/557b6a32221c7f235c4934a38eca8c16b35c308f))
* **agent-core:** remove redundant hook event mappings on codebuddy/cursor ([b6e0e76](https://github.com/termlnk/termlnk/commit/b6e0e76d53a4f7ec02793a46b2072b7e6f6fcf56))
* **agent-core:** reset state on session delete and skip 502 retries ([cc16c24](https://github.com/termlnk/termlnk/commit/cc16c243e1bbfccd165e49fe3c202cdbafcd1626))
* **agent-core:** route MCP registry fetch through configured proxy ([56b9bf2](https://github.com/termlnk/termlnk/commit/56b9bf244e0c4425719c0caa93102b55a9be8f0e))
* **agent-core:** surface provider test errors via stopReason check ([4906057](https://github.com/termlnk/termlnk/commit/49060573b6675db2e1ad819de418cb7f711f8930))
* **agent-hook:** tolerate multiSelect spelling drift ([2490b5c](https://github.com/termlnk/termlnk/commit/2490b5c59e692acc027b4b942a4b50d87fde955c))
* **agent-ui:** truncate tool name to keep status icon visible in narrow panel ([a39336c](https://github.com/termlnk/termlnk/commit/a39336c7e8026b4d54e259777176076a2246a1cd))
* **agent:** type widget tool array items and document layout contract ([f1c342d](https://github.com/termlnk/termlnk/commit/f1c342d2feaf11bf3d0810b9518f8680c100074a))
* **design:** position draggable dialog against full viewport, not workbench-content ([8a656fe](https://github.com/termlnk/termlnk/commit/8a656fe6c9c4a50d5da66b5ed88c2b01882a42bf))
* **desktop:** add min-w-0 to root flex item to prevent layout overflow ([9ce339a](https://github.com/termlnk/termlnk/commit/9ce339a4a7bb639509ab7956265d39c3a12d0d15))
* **desktop:** ship bundled skills outside asar to avoid fs ENOENT ([9120f54](https://github.com/termlnk/termlnk/commit/9120f54d96b2d89fe265edf0d6346eeabf6ca720))
* **dialog:** recenter on content resize until user drags ([89651c6](https://github.com/termlnk/termlnk/commit/89651c6b1967b8698ca58de71e9c587854a05f37))
* **electron-main:** drop AskUserQuestion shortcut from dynamic island ([1e4a260](https://github.com/termlnk/termlnk/commit/1e4a26026ed433fdfc068eaf44b9cb56183eef48))
* **macos-utils:** import Buffer type from node:buffer ([8b90dc5](https://github.com/termlnk/termlnk/commit/8b90dc563dc023fc11b34b6fcf2e2459bc9e2ce9))
* **sftp-ui:** align header height with chat panel header ([8ace285](https://github.com/termlnk/termlnk/commit/8ace285f571249ea3c61050c25933c2c6a3d8d86))
* **terminal-ui:** add i18n description for delete-host shortcut ([b009772](https://github.com/termlnk/termlnk/commit/b009772729a447e689238ca73689c239cd8634d3))
* **terminal-ui:** close active pane instead of whole workspace on cmd+w ([72a5c24](https://github.com/termlnk/termlnk/commit/72a5c2492ca3d83e3a5b25044aca0851123ac435))
* **terminal-ui:** hide tree item edit button until hover and truncate long names ([ccf8bae](https://github.com/termlnk/termlnk/commit/ccf8baeca0898b78e7d67528bfc2b5fb13850f11))
* **ui:** prevent menu merge from leaking keys into unrelated positions ([9e77333](https://github.com/termlnk/termlnk/commit/9e7733383754efffa043cd739776ca3f1fd2bfed))
* **ui:** refresh TooltipWrapper text on locale/shortcut change ([99956ce](https://github.com/termlnk/termlnk/commit/99956ce77fb22254e307de4bdf52127989f13206))
* use XiaomiMiMo icon for Xiaomi providers ([87bb2fa](https://github.com/termlnk/termlnk/commit/87bb2faa8eb0464b6039798ac6a629ce2411bb5a))
* **vite:** exclude test files from .d.ts emission ([684d725](https://github.com/termlnk/termlnk/commit/684d725d91249d9b5f2908d3796170b39419f24e))


### Features

* add inline AI terminal suggestions ([bb0147f](https://github.com/termlnk/termlnk/commit/bb0147f6d0eef51df0afa1e8c42d383d6b6a7e44))
* **agent-core:** add AgentKeepAwakeController to prevent display sleep ([cbe8f38](https://github.com/termlnk/termlnk/commit/cbe8f383c93d16c27bfe147f53db85a6bf354585))
* **agent-core:** wire gemini tool, notification, and pre-compress hooks ([a5ceb2e](https://github.com/termlnk/termlnk/commit/a5ceb2e24a887e47f9bec218f60d8a4be860c18c))
* **agent-hook:** inject full AskUserQuestion decisions ([f6b3437](https://github.com/termlnk/termlnk/commit/f6b3437e538e2b48096f48b190cd88b4448dd2cb))
* **agent-hook:** support multi-question AskUserQuestion across agents ([72d29ef](https://github.com/termlnk/termlnk/commit/72d29efaf3dff43aa876d6f7b8a62b5c73d6054b))
* **agent-ui:** add permission mode selector to chat input ([62d9e3a](https://github.com/termlnk/termlnk/commit/62d9e3a6ad01c98f9f44105d02f71be074e78282))
* **agent-ui:** expand provider logo mappings ([2288fe8](https://github.com/termlnk/termlnk/commit/2288fe8463fce866e1f07c5154932ec81ce9a665))
* **agent-ui:** replace approval pill with persistent approval bar ([3310252](https://github.com/termlnk/termlnk/commit/3310252f07f45453d12669da39a679bddb5be213))
* **agent-ui:** use TooltipWrapper in ChatHeader buttons ([ed61541](https://github.com/termlnk/termlnk/commit/ed61541c6360da44644ec00cb25dfa4741d086e9))
* **agent:** add provider model latency test ([8063ee6](https://github.com/termlnk/termlnk/commit/8063ee6ae235fb85105139f8b0470e30fb2a4bf8))
* **agent:** redesign chat with parts model, retry/edit, restore session, and generative UI widgets ([4cdd04a](https://github.com/termlnk/termlnk/commit/4cdd04acbbe564f0d4d58663f5e4ca350b56607c))
* **agent:** replace command permission with universal tool permission system ([4f294af](https://github.com/termlnk/termlnk/commit/4f294afd2a61f4e4314576dc8c710970d14d5fa1))
* **electron-main:** harden updater with download lock and dedupe checks ([5c060ab](https://github.com/termlnk/termlnk/commit/5c060abfb44a94a72f6c8b9d089deef3a820bc53))
* **electron:** add IKeepAwakeService and keepAwakeWhileAgentActive setting ([998ccad](https://github.com/termlnk/termlnk/commit/998ccad97367c9cf059ac37793dc235977a900b5))
* enable task confirmation and rapid submit sounds by default ([1915036](https://github.com/termlnk/termlnk/commit/1915036e34bc298e78175bace711fbf31b14786f))
* init ([e47f1a4](https://github.com/termlnk/termlnk/commit/e47f1a4f226171e47ca7cc65d10347ffdfb5161f))
* **island-ui:** derive QuestionPanel state via view model ([e122694](https://github.com/termlnk/termlnk/commit/e122694f5a5d3128567bdf1fa366587c8ecdf9be))
* **island-ui:** replace picker with multi-question QuestionPanel ([e35ed95](https://github.com/termlnk/termlnk/commit/e35ed95ecbf006d5440a9572418452c681018e83))
* **settings-ui:** add keep-awake toggle in appearance tab ([956336c](https://github.com/termlnk/termlnk/commit/956336c1df2c18fd4a749876e3903c780dc89d70))
* **settings-ui:** redesign about tab with author link and license badge ([5021358](https://github.com/termlnk/termlnk/commit/50213581d9b5961897f2f484d24fa66042536f9e))
* **settings:** redesign about tab update section ([caba4d1](https://github.com/termlnk/termlnk/commit/caba4d1fdafac86d71cf3c370ccbe63810b6faa7))
* **terminal-ui:** add hosts explorer context menu with new/rename/delete ([fa79619](https://github.com/termlnk/termlnk/commit/fa7961992bc44c2b7482ddc38fc528f68b13bd11))
* **terminal-ui:** add tooltip to tab close button ([a655257](https://github.com/termlnk/termlnk/commit/a6552575fe1aa71bc7ec23150f252cf74f9b167f))
* **ui:** add context menu service and desktop component ([be4eeaf](https://github.com/termlnk/termlnk/commit/be4eeaf050fc2c03bf2f22bc7e5a01d09c13d552))
* **ui:** enhance TooltipWrapper with shortcut hints and i18n keys ([ee9e9ac](https://github.com/termlnk/termlnk/commit/ee9e9ac202b22d6e5a5a159ca63da37d0fdef1f2))
* **updater:** add mock updater service for dev ([76045ea](https://github.com/termlnk/termlnk/commit/76045ea9fed99df68a7ab0e0766069349006a0e1))
* **updater:** polish dialog UI and localize strings ([3487265](https://github.com/termlnk/termlnk/commit/3487265f68352b95910e9eac17f8c509c4ff11fd))
