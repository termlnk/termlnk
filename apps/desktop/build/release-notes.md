## [0.3.6](https://github.com/termlnk/termlnk/compare/v0.3.5...v0.3.6) (2026-08-02)

### Bug Fixes

* **auth:** keep session on transient token refresh failure ([dc98adb](https://github.com/termlnk/termlnk/commit/dc98adb0e7159e7b52ba783842e28cb8b9b3c1c3))
* **auth:** lock the vault on idle instead of signing out ([ac8b0e3](https://github.com/termlnk/termlnk/commit/ac8b0e3d12b481ad8260c76dc59fcd1987f6361e))
* **deps:** align earendil-works deps to 0.83.0 ([6d27cfe](https://github.com/termlnk/termlnk/commit/6d27cfecb42b4cc2f524a74e5a74427f0995d806))
* **desktop:** build node-pty from source on linux ([4365ed1](https://github.com/termlnk/termlnk/commit/4365ed178690ee2ca4df73bb13d2191f13002e85))
* **network:** route cloud requests through the configured proxy ([c56747f](https://github.com/termlnk/termlnk/commit/c56747f28eeefaf0bf6ac82d4a0e50af83b89106))
* **sync:** guard against concurrent websocket open ([a26bb38](https://github.com/termlnk/termlnk/commit/a26bb38faf2ec397db700eaf761407bdf358ae4e))
* **sync:** hold pull cursor behind unapplied patch rows ([40c56eb](https://github.com/termlnk/termlnk/commit/40c56ebd1a57a6ae4102c45c772de84547be3f47))

### Features

* **terminal:** add configurable terminal identity ([ed0f9fc](https://github.com/termlnk/termlnk/commit/ed0f9fccd61104ab85b0b57f75d1dc0cfddf578a))
