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
