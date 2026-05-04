/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Use of this software for any commercial purpose is prohibited.
 * The software is provided "AS IS", WITHOUT WARRANTY OR CONDITION OF ANY KIND,
 * either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import type { Configuration } from 'electron-builder';
import process from 'node:process';

const isSigningEnabled = !!process.env.CSC_LINK;

const config: Configuration = {
  appId: 'termlnk.termlnk',
  productName: 'Termlnk',
  buildVersion: process.env.BUILD_VERSION,
  directories: {
    app: 'build/app',
    output: 'release',
    buildResources: 'build',
  },
  npmRebuild: false,
  nodeGypRebuild: false,
  // Explicit allow-list (relative to `directories.app` = build/app). Native
  // modules are pre-staged into build/app/node_modules by scripts/stage-app.ts,
  // so electron-builder only needs to copy what the staging step produced.
  files: [
    'package.json',
    'dist/**/*',
    {
      from: 'node_modules',
      to: 'node_modules',
      filter: ['**/*'],
    },
  ],
  asar: true,
  asarUnpack: [
    '**/*.node',
    '**/node-pty/prebuilds/**/*',
  ],
  // eslint-disable-next-line no-template-curly-in-string
  artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
  electronLanguages: ['en', 'en-GB', 'en-US', 'zh-CN', 'zh-TW', 'ja', 'ko'],
  extraResources: [
    { from: 'resources/icon-tray.png', to: '.' },
    { from: 'resources/icon-tray.ico', to: '.' },
    { from: 'resources/app-update.yml', to: '.' },
    // Outside app.asar so Node's fs APIs read real files instead of asar
    // virtual entries (which throw ENOENT for some directory entries).
    { from: '../../packages/agent-core/src/bundled-skills', to: 'bundled-skills' },
  ],
  electronFuses: {
    runAsNode: false,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
    resetAdHocDarwinSignature: !isSigningEnabled,
  },
  publish: {
    provider: 'generic',
    url: 'https://update.termlnk.com/desktop',
  },

  mac: {
    category: 'public.app-category.developer-tools',
    icon: 'resources/icon.icns',
    target: ['dmg', 'zip'],
    // Surfaced by macOS when Termlnk first requests Accessibility. The
    // Dynamic Island uses it to replay user-picks from the notch into
    // the terminal app running an external Claude Code CLI (AskUser-
    // Question etc.) so the CLI TUI and the island stay in sync.
    extendInfo: {
      NSAccessibilityUsageDescription: 'Termlnk requests Accessibility permission so the Dynamic Island can relay your choices to the terminal window running Claude Code (syncing AskUserQuestion picks between the notch and the CLI).',
    },
    ...(isSigningEnabled
      ? {
        hardenedRuntime: true,
        gatekeeperAssess: false,
        entitlements: 'build/entitlements.mac.plist',
        entitlementsInherit: 'build/entitlements.mac.plist',
        notarize: true,
      }
      : {
        identity: null,
      }),
  },
  dmg: {
    background: 'static/dmg-background.png',
    icon: 'static/dmg-icon.icns',
    iconSize: 160,
    window: { width: 660, height: 400 },
    contents: [
      { x: 180, y: 170, type: 'file' },
      { x: 480, y: 170, type: 'link', path: '/Applications' },
    ],
  },
  win: {
    icon: 'resources/icon.ico',
    target: ['nsis', 'tar.gz'],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    // eslint-disable-next-line no-template-curly-in-string
    artifactName: '${productName}-${version}-${os}-${arch}-setup.${ext}',
  },
  linux: {
    category: 'Development;System;TerminalEmulator',
    icon: 'resources/icon.png',
    executableArgs: [
      '--enable-features=UseOzonePlatform',
      '--ozone-platform-hint=auto',
    ],
    target: ['AppImage', 'deb', 'rpm', 'tar.gz'],
  },
  deb: {},
  rpm: {
    fpm: ['--rpm-rpmbuild-define', '_build_id_links none'],
  },
};

export default config;
