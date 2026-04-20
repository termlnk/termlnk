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

export type ShellType = 'posix' | 'fish' | 'powershell' | 'cmd' | 'unknown';

function basename(shellPath: string): string {
  const lastSlash = Math.max(shellPath.lastIndexOf('/'), shellPath.lastIndexOf('\\'));
  return lastSlash >= 0 ? shellPath.slice(lastSlash + 1) : shellPath;
}

export function detectShellType(shellPath: string | null | undefined): ShellType {
  if (!shellPath) return 'unknown';

  const name = basename(shellPath).toLowerCase().replace(/\.exe$/i, '');

  if (['bash', 'zsh', 'sh', 'dash', 'ash', 'ksh', 'tcsh', 'csh'].includes(name)) {
    return 'posix';
  }
  if (name === 'fish') {
    return 'fish';
  }
  if (['powershell', 'pwsh'].includes(name)) {
    return 'powershell';
  }
  if (['cmd', 'command'].includes(name)) {
    return 'cmd';
  }

  return 'unknown';
}

export function escapePathForShell(filePath: string, shellType: ShellType): string {
  switch (shellType) {
    case 'posix':
    case 'fish':
    case 'unknown': {
      // Wrap in single quotes; escape internal single quotes as '\''
      const escaped = filePath.replace(/'/g, '\'\\\'\'');
      return `'${escaped}'`;
    }
    case 'powershell': {
      // PowerShell: single quotes with doubled internal quotes
      const escaped = filePath.replace(/'/g, '\'\'');
      return `'${escaped}'`;
    }
    case 'cmd': {
      // cmd.exe: wrap in double quotes
      return `"${filePath}"`;
    }
  }
}

export function escapePathsForShell(paths: string[], shellType: ShellType): string {
  return paths.map((p) => escapePathForShell(p, shellType)).join(' ');
}
