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

import type { CliOptions, Configuration } from 'electron-builder';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { Arch, build, DIR_TARGET, Platform } from 'electron-builder';
import builderConfig from '../electron-builder';

const DESKTOP_ROOT = resolve(import.meta.dirname, '..');
const STAGED_APP_DIR = resolve(DESKTOP_ROOT, 'build/app');

const rawArgs = process.argv.slice(2);
const scriptArgs = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;

const { values: args } = parseArgs({
  args: scriptArgs,
  allowPositionals: false,
  options: {
    dir: { type: 'boolean', default: false },
    mac: { type: 'boolean', default: false },
    win: { type: 'boolean', default: false },
    linux: { type: 'boolean', default: false },
    x64: { type: 'boolean', default: false },
    arm64: { type: 'boolean', default: false },
    ia32: { type: 'boolean', default: false },
    armv7l: { type: 'boolean', default: false },
    universal: { type: 'boolean', default: false },
  },
});

function cloneConfig(config: Configuration): Configuration {
  return structuredClone(config) as Configuration;
}

function rebasePath(path: string): string {
  return resolve(DESKTOP_ROOT, path);
}

function rebaseOptionalPath(path: string | null | undefined): string | null | undefined {
  return path ? rebasePath(path) : path;
}

function rebaseOptionalStringPath(path: string | undefined): string | undefined {
  return path ? rebasePath(path) : path;
}

function rebaseOptionalPaths(paths: string[] | null | undefined): string[] | null | undefined {
  return paths?.map((path) => rebasePath(path)) ?? paths;
}

function rebaseLicense(license: string | Record<string, string> | null | undefined): string | Record<string, string> | null | undefined {
  if (typeof license === 'string') {
    return rebasePath(license);
  }
  if (!license) {
    return license;
  }

  return Object.fromEntries(
    Object.entries(license).map(([language, path]) => [language, rebasePath(path)])
  );
}

function getElectronVersion(): string {
  const packageJson = JSON.parse(readFileSync(resolve(DESKTOP_ROOT, 'package.json'), 'utf-8'));
  const version = packageJson.devDependencies?.electron;
  if (typeof version !== 'string') {
    throw new TypeError('Cannot find electron in apps/desktop/package.json devDependencies.');
  }

  return version.replace(/^[^\d]*/, '');
}

function createStagedProjectConfig(): Configuration {
  const source = cloneConfig(builderConfig);
  const directories = { ...source.directories };

  delete directories.app;
  directories.output = rebasePath(directories.output ?? 'release');
  directories.buildResources = rebasePath(directories.buildResources ?? 'build');

  const extraResources = Array.isArray(source.extraResources)
    ? source.extraResources
    : source.extraResources
      ? [source.extraResources]
      : [];

  const config: Configuration = {
    ...source,
    electronVersion: source.electronVersion ?? getElectronVersion(),
    directories,
    extraResources: extraResources.map((resource) => {
      if (typeof resource === 'string') {
        return rebasePath(resource);
      }

      return {
        ...resource,
        from: resource.from ? rebasePath(resource.from) : resource.from,
      };
    }),
    mac: source.mac
      ? {
        ...source.mac,
        icon: rebaseOptionalPath(source.mac.icon),
        entitlements: rebaseOptionalPath(source.mac.entitlements),
        entitlementsInherit: rebaseOptionalPath(source.mac.entitlementsInherit),
        entitlementsLoginHelper: rebaseOptionalPath(source.mac.entitlementsLoginHelper),
        provisioningProfile: rebaseOptionalPath(source.mac.provisioningProfile),
        binaries: rebaseOptionalPaths(source.mac.binaries),
        requirements: rebaseOptionalPath(source.mac.requirements),
      }
      : source.mac,
    mas: source.mas
      ? {
        ...source.mas,
        icon: rebaseOptionalPath(source.mas.icon),
        entitlements: rebaseOptionalPath(source.mas.entitlements),
        entitlementsInherit: rebaseOptionalPath(source.mas.entitlementsInherit),
        entitlementsLoginHelper: rebaseOptionalPath(source.mas.entitlementsLoginHelper),
        provisioningProfile: rebaseOptionalPath(source.mas.provisioningProfile),
        binaries: rebaseOptionalPaths(source.mas.binaries),
        requirements: rebaseOptionalPath(source.mas.requirements),
      }
      : source.mas,
    dmg: source.dmg
      ? {
        ...source.dmg,
        background: rebaseOptionalPath(source.dmg.background),
        badgeIcon: rebaseOptionalPath(source.dmg.badgeIcon),
        icon: rebaseOptionalPath(source.dmg.icon),
        license: rebaseLicense(source.dmg.license),
      }
      : source.dmg,
    win: source.win
      ? {
        ...source.win,
        icon: rebaseOptionalPath(source.win.icon),
      }
      : source.win,
    linux: source.linux
      ? {
        ...source.linux,
        icon: rebaseOptionalStringPath(source.linux.icon),
      }
      : source.linux,
    releaseInfo: source.releaseInfo?.releaseNotesFile
      ? {
        ...source.releaseInfo,
        releaseNotesFile: rebasePath(source.releaseInfo.releaseNotesFile),
      }
      : source.releaseInfo,
  };

  return config;
}

function selectedArchitectures(): Arch[] {
  const archs: Arch[] = [];
  if (args.x64) {
    archs.push(Arch.x64);
  }
  if (args.arm64) {
    archs.push(Arch.arm64);
  }
  if (args.ia32) {
    archs.push(Arch.ia32);
  }
  if (args.armv7l) {
    archs.push(Arch.armv7l);
  }
  if (args.universal) {
    archs.push(Arch.universal);
  }

  if (archs.length === 0) {
    archs.push(process.arch === 'arm64' ? Arch.arm64 : Arch.x64);
  }

  return archs;
}

function selectedPlatforms(): Platform[] {
  const platforms: Platform[] = [];
  if (args.mac) {
    platforms.push(Platform.MAC);
  }
  if (args.win) {
    platforms.push(Platform.WINDOWS);
  }
  if (args.linux) {
    platforms.push(Platform.LINUX);
  }

  if (platforms.length === 0) {
    platforms.push(Platform.current());
  }

  return platforms;
}

function createTargets(): Map<Platform, Map<Arch, string[]>> {
  const targets = new Map<Platform, Map<Arch, string[]>>();
  const targetNames = args.dir ? [DIR_TARGET] : [];

  for (const platform of selectedPlatforms()) {
    const archTargets = new Map<Arch, string[]>();
    for (const arch of selectedArchitectures()) {
      archTargets.set(arch, targetNames);
    }
    targets.set(platform, archTargets);
  }

  return targets;
}

const options: CliOptions = {
  projectDir: STAGED_APP_DIR,
  config: createStagedProjectConfig(),
  targets: createTargets(),
};

await build(options);
