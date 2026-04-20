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

import { Platform } from '@termlnk/core';
import { describe, expect, it } from 'vitest';
import { getAvailableLocalTerminalShellOptions, resolveConfiguredLocalTerminalShell } from './local-terminal-shell';

describe('resolveConfiguredLocalTerminalShell', () => {
  it('should prefer PowerShell for system shell on Windows', () => {
    const env = {
      ProgramFiles: 'C:\\Program Files',
      SystemRoot: 'C:\\Windows',
    };

    expect(resolveConfiguredLocalTerminalShell(
      { defaultShell: 'system' },
      Platform.Windows,
      env,
      (targetPath) => targetPath === 'C:\\Program Files\\PowerShell\\7\\pwsh.exe'
        || targetPath === 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
        || targetPath === 'C:\\Windows\\System32\\cmd.exe'
    )).toBe('C:\\Program Files\\PowerShell\\7\\pwsh.exe');
  });

  it('should fall back to Command Prompt for system shell on Windows', () => {
    const env = {
      COMSPEC: 'C:\\Windows\\System32\\cmd.exe',
      SystemRoot: 'C:\\Windows',
    };

    expect(resolveConfiguredLocalTerminalShell(
      { defaultShell: 'system' },
      Platform.Windows,
      env,
      (targetPath) => targetPath === 'C:\\Windows\\System32\\cmd.exe'
    )).toBe('C:\\Windows\\System32\\cmd.exe');
  });

  it('should resolve the built-in PowerShell path on Windows', () => {
    const env = {
      SystemRoot: 'C:\\Windows',
    };

    expect(resolveConfiguredLocalTerminalShell(
      { defaultShell: 'powershell' },
      Platform.Windows,
      env,
      (targetPath) => targetPath === 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
    )).toBe('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  });

  it('should prefer PowerShell Core for the Windows PowerShell alias', () => {
    const env = {
      ProgramFiles: 'C:\\Program Files',
      SystemRoot: 'C:\\Windows',
    };

    expect(resolveConfiguredLocalTerminalShell(
      { defaultShell: 'powershell' },
      Platform.Windows,
      env,
      (targetPath) => targetPath === 'C:\\Program Files\\PowerShell\\7\\pwsh.exe'
        || targetPath === 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
    )).toBe('C:\\Program Files\\PowerShell\\7\\pwsh.exe');
  });

  it('should prefer COMSPEC for command prompt on Windows', () => {
    expect(resolveConfiguredLocalTerminalShell(
      { defaultShell: 'command-prompt' },
      Platform.Windows,
      { COMSPEC: 'C:\\Windows\\System32\\cmd.exe' },
      () => false
    )).toBe('C:\\Windows\\System32\\cmd.exe');
  });

  it('should normalize quoted COMSPEC values on Windows', () => {
    expect(resolveConfiguredLocalTerminalShell(
      { defaultShell: 'command-prompt' },
      Platform.Windows,
      { COMSPEC: '\"C:\\Windows\\System32\\cmd.exe\"' },
      (targetPath) => targetPath === 'C:\\Windows\\System32\\cmd.exe'
    )).toBe('C:\\Windows\\System32\\cmd.exe');
  });

  it('should ignore legacy Windows shell aliases on non-Windows platforms', () => {
    expect(resolveConfiguredLocalTerminalShell({
      defaultShell: 'powershell',
    }, Platform.Mac)).toBeUndefined();
  });

  it('should preserve detected shell paths on POSIX platforms', () => {
    expect(resolveConfiguredLocalTerminalShell(
      { defaultShell: '/bin/zsh' },
      Platform.Mac,
      {},
      (targetPath) => targetPath === '/bin/zsh'
    )).toBe('/bin/zsh');
  });
});

describe('getAvailableLocalTerminalShellOptions', () => {
  it('should detect Windows shell executables from common paths and PATH', () => {
    const env = {
      COMSPEC: 'C:\\Windows\\System32\\cmd.exe',
      PATH: 'C:\\Program Files\\PowerShell\\7;C:\\Users\\Test\\AppData\\Local\\Programs\\zsh',
      PATHEXT: '.EXE;.CMD',
      ProgramFiles: 'C:\\Program Files',
      SystemRoot: 'C:\\Windows',
    };
    const existingPaths = new Set([
      'C:\\Windows\\System32\\cmd.exe',
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
      'C:\\Users\\Test\\AppData\\Local\\Programs\\zsh\\zsh.exe',
    ]);

    expect(getAvailableLocalTerminalShellOptions(
      Platform.Windows,
      env,
      (targetPath) => existingPaths.has(targetPath)
    )).toEqual([
      {
        value: 'powershell',
        label: 'PowerShell',
      },
      {
        value: 'command-prompt',
        label: 'Command Prompt',
      },
      {
        value: 'C:\\Users\\Test\\AppData\\Local\\Programs\\zsh\\zsh.exe',
        label: 'zsh',
      },
    ]);
  });

  it('should detect POSIX shells from /etc/shells and common locations', () => {
    const existingPaths = new Set([
      '/bin/bash',
      '/bin/zsh',
      '/opt/homebrew/bin/fish',
    ]);

    expect(getAvailableLocalTerminalShellOptions(
      Platform.Mac,
      {},
      (targetPath) => existingPaths.has(targetPath),
      () => `
# comment
/bin/bash
/bin/zsh
/opt/homebrew/bin/fish
/usr/bin/false
`
    )).toEqual([
      {
        value: '/bin/bash',
        label: 'bash',
      },
      {
        value: '/bin/zsh',
        label: 'zsh',
      },
      {
        value: '/opt/homebrew/bin/fish',
        label: 'fish',
      },
    ]);
  });
});
