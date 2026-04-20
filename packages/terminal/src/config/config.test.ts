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
import { getDefaultLocalTerminalConfig, normalizeLocalTerminalConfig, resolveLegacyShellValue } from './config';

describe('local terminal config', () => {
  it('should default to PowerShell on Windows', () => {
    expect(getDefaultLocalTerminalConfig(Platform.Windows)).toEqual({
      defaultShell: 'powershell',
    });
  });

  it('should default to system shell on non-Windows platforms', () => {
    expect(getDefaultLocalTerminalConfig(Platform.Mac)).toEqual({
      defaultShell: 'system',
    });
    expect(getDefaultLocalTerminalConfig(Platform.Linux)).toEqual({
      defaultShell: 'system',
    });
  });

  it('should normalize empty values to the platform default', () => {
    expect(normalizeLocalTerminalConfig({
      defaultShell: '   ' as never,
    }, Platform.Windows)).toEqual({
      defaultShell: 'powershell',
    });
  });

  it('should preserve supported shell values', () => {
    expect(normalizeLocalTerminalConfig({
      defaultShell: 'command-prompt',
    }, Platform.Windows)).toEqual({
      defaultShell: 'command-prompt',
    });
  });

  it('should preserve custom shell paths', () => {
    expect(normalizeLocalTerminalConfig({
      defaultShell: '/opt/homebrew/bin/fish',
    }, Platform.Mac)).toEqual({
      defaultShell: '/opt/homebrew/bin/fish',
    });
  });

  it('should migrate PowerShell executable paths to the unified PowerShell option', () => {
    expect(resolveLegacyShellValue(
      'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
      [
        { value: 'powershell', label: 'PowerShell' },
        { value: 'command-prompt', label: 'Command Prompt' },
      ]
    )).toBe('powershell');

    expect(resolveLegacyShellValue(
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      [
        { value: 'powershell', label: 'PowerShell' },
      ]
    )).toBe('powershell');
  });

  it('should migrate Command Prompt executable paths to the built-in option', () => {
    expect(resolveLegacyShellValue(
      'C:\\Windows\\System32\\cmd.exe',
      [
        { value: 'powershell', label: 'PowerShell' },
        { value: 'command-prompt', label: 'Command Prompt' },
      ]
    )).toBe('command-prompt');
  });
});
