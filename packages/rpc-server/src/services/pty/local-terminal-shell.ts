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

import type { ILocalTerminalConfig, ILocalTerminalShellOption } from '@termlnk/terminal';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';
import { Platform } from '@termlnk/core';
import { normalizeLocalTerminalConfig } from '@termlnk/terminal';

type PathExists = (targetPath: string) => boolean;
type FileReader = (targetPath: string) => string;

interface IDetectedShellCandidate {
  label: string;
  candidates: string[];
  value?: string;
}

const POSIX_SHELL_NAMES = new Set([
  'ash',
  'bash',
  'csh',
  'dash',
  'elvish',
  'fish',
  'ksh',
  'nu',
  'sh',
  'tcsh',
  'xonsh',
  'zsh',
]);

function resolveExistingPath(candidates: string[], pathExists: PathExists): string | null {
  for (const candidate of candidates) {
    if (candidate.length > 0 && pathExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getWindowsDirectory(env: NodeJS.ProcessEnv): string {
  return env.windir || env.WINDIR || env.SystemRoot || env.SYSTEMROOT || 'C:\\Windows';
}

function getProgramFilesDirectory(env: NodeJS.ProcessEnv): string {
  return env.ProgramFiles || 'C:\\Program Files';
}

function getProgramFilesX86Directory(env: NodeJS.ProcessEnv): string {
  return env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
}

function getLocalAppDataDirectory(env: NodeJS.ProcessEnv): string {
  return env.LOCALAPPDATA || path.win32.join(env.USERPROFILE || 'C:\\Users\\Default', 'AppData', 'Local');
}

function getWindowsPowerShellCandidates(env: NodeJS.ProcessEnv): string[] {
  const windowsDir = getWindowsDirectory(env);

  return [
    path.win32.join(windowsDir, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    'powershell.exe',
  ];
}

function getPowerShellCoreCandidates(env: NodeJS.ProcessEnv): string[] {
  const programFiles = getProgramFilesDirectory(env);
  const programFilesX86 = getProgramFilesX86Directory(env);
  const localAppData = getLocalAppDataDirectory(env);

  return [
    path.win32.join(programFiles, 'PowerShell', '7', 'pwsh.exe'),
    path.win32.join(programFiles, 'PowerShell', '7-preview', 'pwsh.exe'),
    path.win32.join(programFilesX86, 'PowerShell', '7', 'pwsh.exe'),
    path.win32.join(localAppData, 'Microsoft', 'WindowsApps', 'pwsh.exe'),
    'pwsh.exe',
  ];
}

function getCommandPromptCandidates(env: NodeJS.ProcessEnv): string[] {
  const windowsDir = getWindowsDirectory(env);

  return [
    stripWrappingQuotes(env.COMSPEC || ''),
    path.win32.join(windowsDir, 'System32', 'cmd.exe'),
    'cmd.exe',
  ];
}

function getGitBashCandidates(env: NodeJS.ProcessEnv): string[] {
  const programFiles = getProgramFilesDirectory(env);
  const programFilesX86 = getProgramFilesX86Directory(env);
  const localAppData = getLocalAppDataDirectory(env);

  return [
    path.win32.join(programFiles, 'Git', 'bin', 'bash.exe'),
    path.win32.join(programFiles, 'Git', 'usr', 'bin', 'bash.exe'),
    path.win32.join(programFilesX86, 'Git', 'bin', 'bash.exe'),
    path.win32.join(programFilesX86, 'Git', 'usr', 'bin', 'bash.exe'),
    path.win32.join(localAppData, 'Programs', 'Git', 'bin', 'bash.exe'),
  ];
}

function stripWrappingQuotes(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }

  return value;
}

function getPathEntries(env: NodeJS.ProcessEnv, currentPlatform: Platform): string[] {
  const pathValue = env.PATH || env.Path || env.path || '';
  const delimiter = currentPlatform === Platform.Windows ? ';' : ':';
  return pathValue
    .split(delimiter)
    .map((entry) => stripWrappingQuotes(entry.trim()))
    .filter((entry) => entry.length > 0);
}

function getWindowsPathExtensions(env: NodeJS.ProcessEnv): string[] {
  const pathExtValue = env.PATHEXT || '.COM;.EXE;.BAT;.CMD';
  const extensions = pathExtValue
    .split(';')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  return extensions.length > 0
    ? [...new Set(extensions)]
    : ['.exe'];
}

function hasPathSeparator(targetPath: string): boolean {
  return targetPath.includes('/') || targetPath.includes('\\');
}

function isAbsolutePath(targetPath: string, currentPlatform: Platform): boolean {
  return currentPlatform === Platform.Windows
    ? path.win32.isAbsolute(targetPath)
    : path.posix.isAbsolute(targetPath);
}

function resolveCommandInPath(
  command: string,
  currentPlatform: Platform,
  env: NodeJS.ProcessEnv,
  pathExists: PathExists
): string | null {
  const pathEntries = getPathEntries(env, currentPlatform);
  if (pathEntries.length === 0) {
    return null;
  }

  if (currentPlatform === Platform.Windows) {
    const extension = path.win32.extname(command).toLowerCase();
    const candidateNames = extension.length > 0
      ? [command]
      : getWindowsPathExtensions(env).map((ext) => `${command}${ext}`);

    for (const basePath of pathEntries) {
      for (const candidateName of candidateNames) {
        const candidatePath = path.win32.join(basePath, candidateName);
        if (pathExists(candidatePath)) {
          return candidatePath;
        }
      }
    }

    return null;
  }

  for (const basePath of pathEntries) {
    const candidatePath = path.posix.join(basePath, command);
    if (pathExists(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

function resolveExecutableCandidate(
  candidate: string,
  currentPlatform: Platform,
  env: NodeJS.ProcessEnv,
  pathExists: PathExists
): string | null {
  const normalizedCandidate = candidate.trim();
  if (normalizedCandidate.length === 0) {
    return null;
  }

  if (isAbsolutePath(normalizedCandidate, currentPlatform) || hasPathSeparator(normalizedCandidate)) {
    return pathExists(normalizedCandidate) ? normalizedCandidate : null;
  }

  if (pathExists(normalizedCandidate)) {
    return normalizedCandidate;
  }

  return resolveCommandInPath(normalizedCandidate, currentPlatform, env, pathExists);
}

function resolveShellCandidate(
  candidate: IDetectedShellCandidate,
  currentPlatform: Platform,
  env: NodeJS.ProcessEnv,
  pathExists: PathExists
): ILocalTerminalShellOption | null {
  const resolvedPath = resolveExistingPath(
    candidate.candidates
      .map((entry) => resolveExecutableCandidate(entry, currentPlatform, env, pathExists))
      .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0),
    pathExists
  );

  if (!resolvedPath) {
    return null;
  }

  return {
    value: candidate.value || resolvedPath,
    label: candidate.label,
  };
}

function getShellBaseName(shellPath: string): string {
  return path.basename(shellPath).replace(/\.exe$/i, '').toLowerCase();
}

function formatDetectedShellLabel(shellPath: string): string {
  const shellName = getShellBaseName(shellPath);

  if (shellName === 'cmd') {
    return 'Command Prompt';
  }

  if (shellName === 'powershell') {
    return shellPath.toLowerCase().includes('windowspowershell')
      ? 'Windows PowerShell'
      : 'PowerShell';
  }

  if (shellName === 'pwsh') {
    return 'PowerShell';
  }

  if (shellName === 'nu') {
    return 'Nushell';
  }

  if (shellName === 'wsl') {
    return 'WSL';
  }

  if (shellName === 'bash') {
    const lowerPath = shellPath.toLowerCase();
    if (lowerPath.includes('/git/') || lowerPath.includes('\\git\\')) {
      return 'Git Bash';
    }
  }

  return shellName;
}

function normalizeShellOptionKey(value: string, currentPlatform: Platform): string {
  return currentPlatform === Platform.Windows
    ? value.toLowerCase()
    : value;
}

function dedupeShellOptions(
  options: ILocalTerminalShellOption[],
  currentPlatform: Platform
): ILocalTerminalShellOption[] {
  const seen = new Set<string>();

  return options.filter((option) => {
    const key = normalizeShellOptionKey(option.value, currentPlatform);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function resolveWindowsPreferredShell(
  env: NodeJS.ProcessEnv,
  pathExists: PathExists
): string | null {
  return resolveExistingPath([
    ...getPowerShellCoreCandidates(env),
    ...getWindowsPowerShellCandidates(env),
    ...getCommandPromptCandidates(env),
  ], pathExists);
}

function getWindowsShellCandidates(env: NodeJS.ProcessEnv): IDetectedShellCandidate[] {
  const windowsDir = getWindowsDirectory(env);

  return [
    {
      label: 'PowerShell',
      value: 'powershell',
      candidates: [
        ...getPowerShellCoreCandidates(env),
        ...getWindowsPowerShellCandidates(env),
      ],
    },
    {
      label: 'Command Prompt',
      value: 'command-prompt',
      candidates: getCommandPromptCandidates(env),
    },
    {
      label: 'Git Bash',
      candidates: getGitBashCandidates(env),
    },
    {
      label: 'bash',
      candidates: ['bash.exe'],
    },
    {
      label: 'zsh',
      candidates: ['zsh.exe'],
    },
    {
      label: 'fish',
      candidates: ['fish.exe'],
    },
    {
      label: 'Nushell',
      candidates: ['nu.exe'],
    },
    {
      label: 'WSL',
      candidates: [
        path.win32.join(windowsDir, 'System32', 'wsl.exe'),
        'wsl.exe',
      ],
    },
  ];
}

function readEtcShells(readFile: FileReader): string[] {
  try {
    return readFile('/etc/shells')
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#') && line.startsWith('/'));
  } catch {
    return [];
  }
}

function getPosixShellCandidates(
  currentPlatform: Platform,
  readFile: FileReader
): string[] {
  const commonCandidates = currentPlatform === Platform.Mac
    ? [
      '/bin/zsh',
      '/bin/bash',
      '/bin/sh',
      '/opt/homebrew/bin/fish',
      '/usr/local/bin/fish',
      '/opt/homebrew/bin/nu',
      '/usr/local/bin/nu',
      '/opt/homebrew/bin/elvish',
      '/usr/local/bin/elvish',
      '/opt/homebrew/bin/xonsh',
      '/usr/local/bin/xonsh',
    ]
    : [
      '/bin/bash',
      '/bin/sh',
      '/bin/zsh',
      '/usr/bin/bash',
      '/usr/bin/zsh',
      '/usr/bin/fish',
      '/usr/local/bin/fish',
      '/usr/bin/nu',
      '/usr/local/bin/nu',
      '/usr/bin/elvish',
      '/usr/local/bin/elvish',
      '/usr/bin/xonsh',
      '/usr/local/bin/xonsh',
    ];

  return [...new Set([...readEtcShells(readFile), ...commonCandidates])];
}

function isSupportedPosixShell(shellPath: string): boolean {
  return POSIX_SHELL_NAMES.has(getShellBaseName(shellPath));
}

export function getAvailableLocalTerminalShellOptions(
  currentPlatform: Platform,
  env: NodeJS.ProcessEnv = process.env,
  pathExists: PathExists = existsSync,
  readFile: FileReader = (targetPath) => readFileSync(targetPath, 'utf8')
): ILocalTerminalShellOption[] {
  if (currentPlatform === Platform.Windows) {
    return dedupeShellOptions(
      getWindowsShellCandidates(env)
        .map((candidate) => resolveShellCandidate(candidate, currentPlatform, env, pathExists))
        .filter((candidate): candidate is ILocalTerminalShellOption => candidate !== null),
      currentPlatform
    );
  }

  const resolvedShells = getPosixShellCandidates(currentPlatform, readFile)
    .filter((candidate) => isSupportedPosixShell(candidate))
    .map((candidate) => resolveExecutableCandidate(candidate, currentPlatform, env, pathExists))
    .filter((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0)
    .map((candidate) => ({
      value: candidate,
      label: formatDetectedShellLabel(candidate),
    }));

  return dedupeShellOptions(resolvedShells, currentPlatform);
}

export function resolveConfiguredLocalTerminalShell(
  value: Partial<ILocalTerminalConfig> | null,
  currentPlatform: Platform,
  env: NodeJS.ProcessEnv = process.env,
  pathExists: PathExists = existsSync
): string | undefined {
  const config = normalizeLocalTerminalConfig(value, currentPlatform);

  if (config.defaultShell === 'system') {
    if (currentPlatform === Platform.Windows) {
      return resolveWindowsPreferredShell(env, pathExists) || 'pwsh.exe';
    }

    return undefined;
  }

  if (currentPlatform === Platform.Windows) {
    switch (config.defaultShell) {
      case 'powershell':
        return resolveExistingPath([
          ...getPowerShellCoreCandidates(env),
          ...getWindowsPowerShellCandidates(env),
        ], pathExists) || 'pwsh.exe';
      case 'command-prompt':
        if (env.COMSPEC && env.COMSPEC.length > 0) {
          const normalizedComSpec = stripWrappingQuotes(env.COMSPEC);
          const resolvedComSpec = resolveExecutableCandidate(normalizedComSpec, currentPlatform, env, pathExists);
          if (resolvedComSpec) {
            return resolvedComSpec;
          }
          if (normalizedComSpec.length > 0) {
            return normalizedComSpec;
          }
        }
        return resolveExistingPath(getCommandPromptCandidates(env), pathExists) || 'cmd.exe';
      default:
        return resolveExecutableCandidate(config.defaultShell, currentPlatform, env, pathExists) || config.defaultShell;
    }
  }

  if (config.defaultShell === 'powershell' || config.defaultShell === 'command-prompt') {
    return undefined;
  }

  return resolveExecutableCandidate(config.defaultShell, currentPlatform, env, pathExists) || config.defaultShell;
}
