#!/usr/bin/env bash
#
# EAS Build post-install hook for termlnk-mobile.
#
# After EAS runs `pnpm install`, this script provisions the Rust toolchain
# and invokes `pnpm --filter @termlnk/react-native-russh build:native` so
# the gitignored xcframework (iOS) / jniLibs (Android) are regenerated on
# the build agent before cocoapods / gradle link the @termlnk/react-native-russh
# package.
#
# Why this lives here (not inside @termlnk/react-native-russh):
#   * Only EAS Build runs into the missing-artefacts case. Local devs run
#     `pnpm --filter @termlnk/react-native-russh build:ios` (or :android)
#     themselves and the .gitignored output sits beside the source.
#   * The package itself stays toolchain-agnostic for typecheck / metro;
#     pulling rustup install into its own postinstall would hurt every
#     `pnpm install` on contributors' machines.
#
# Detect platform via EAS-provided env. On iOS builds (macOS hosts) we
# only build iOS; on Android builds (Linux hosts) we only build Android.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PACKAGE_DIR="$REPO_ROOT/apps/mobile/packages/react-native-russh"

# EAS sets EAS_BUILD_PLATFORM to "ios" or "android".
PLATFORM="${EAS_BUILD_PLATFORM:-}"
if [[ -z "$PLATFORM" ]]; then
  case "$(uname -s)" in
    Darwin) PLATFORM=ios ;;
    Linux)  PLATFORM=android ;;
    *)      echo "unsupported host OS: $(uname -s)"; exit 1 ;;
  esac
  echo "[eas-prepare-rust] EAS_BUILD_PLATFORM unset; inferred '$PLATFORM' from host."
fi

echo "[eas-prepare-rust] platform=$PLATFORM repo_root=$REPO_ROOT"

# Install rustup (stable) if missing. EAS images do not bundle rustup.
if ! command -v cargo >/dev/null 2>&1; then
  echo "[eas-prepare-rust] installing rustup stable toolchain..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs |
    sh -s -- -y --default-toolchain stable --profile minimal --no-modify-path
fi

# shellcheck disable=SC1091
. "$HOME/.cargo/env"

# Cross-compile targets for the chosen platform.
if [[ "$PLATFORM" == "ios" ]]; then
  echo "[eas-prepare-rust] adding iOS rust targets..."
  rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
elif [[ "$PLATFORM" == "android" ]]; then
  echo "[eas-prepare-rust] adding Android rust targets..."
  rustup target add \
    aarch64-linux-android \
    armv7-linux-androideabi \
    x86_64-linux-android \
    i686-linux-android

  if ! command -v cargo-ndk >/dev/null 2>&1; then
    echo "[eas-prepare-rust] installing cargo-ndk..."
    cargo install cargo-ndk
  fi

  # Locate NDK. EAS sets ANDROID_NDK_HOME on its Android images; if absent,
  # fall back to the highest-numbered NDK under $ANDROID_HOME.
  if [[ -z "${ANDROID_NDK_HOME:-}" && -d "${ANDROID_HOME:-}/ndk" ]]; then
    ANDROID_NDK_HOME="$(ls -d "$ANDROID_HOME"/ndk/* | sort -V | tail -n1)"
    export ANDROID_NDK_HOME
    echo "[eas-prepare-rust] inferred ANDROID_NDK_HOME=$ANDROID_NDK_HOME"
  fi
fi

cd "$PACKAGE_DIR"

# `ubrn build $PLATFORM --and-generate --release` cross-compiles the rust
# workspace, regenerates the codegen files (already committed but harmless
# to overwrite with identical output), and produces the xcframework /
# jniLibs that cocoapods / gradle expect.
echo "[eas-prepare-rust] running ubrn build $PLATFORM --and-generate --release..."
pnpm exec ubrn build "$PLATFORM" --and-generate --release

echo "[eas-prepare-rust] done."
