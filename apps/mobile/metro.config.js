// Metro bundler config for Termlnk mobile inside the pnpm monorepo.
//
// Expo SDK 52+ ships pnpm workspace auto-detection: it walks up from the project root,
// adds every sibling package's `node_modules` to watchFolders, and rewrites symlinked
// imports. We still extend `getDefaultConfig` with two opt-ins:
//   1. `unstable_enableSymlinks` — pnpm's hoisted node_modules layout uses symlinks.
//   2. `unstable_enablePackageExports` — every @termlnk/* package ships its source
//      via the `exports` map (`./src/index.ts`); without this Metro defaults to
//      `main` resolution and misses subpath exports.
//
// Refs: https://docs.expo.dev/guides/monorepos/ + byCedric/expo-monorepo-example.

const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

// `@termlnk/auth-core` peers @termlnk/database for the TokenStorageService path. The
// mobile app substitutes ExpoSecureStoreTokenStorageService and never imports the
// database token storage, so blocking the resolver here prevents accidental drag-in.
config.resolver.blockList = [/packages\/database\/src\/.*/, /packages\/database\/lib\/.*/];

// NativeWind v5 delegates CSS handling to react-native-css. The wrapper keeps
// the global React Native className polyfill enabled so existing JSX does not
// need to import styled primitives one file at a time.
module.exports = withNativewind(config, {
  typescriptEnvPath: './nativewind-env.d.ts',
});
