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
import { getDefaultShell, getDefaultShellArgs } from './pty-process';

describe('getDefaultShell', () => {
  it('should strip wrapping quotes from COMSPEC on Windows', () => {
    expect(getDefaultShell(Platform.Windows, {
      COMSPEC: '\"C:\\Windows\\System32\\cmd.exe\"',
    })).toBe('C:\\Windows\\System32\\cmd.exe');
  });
});

describe('getDefaultShellArgs', () => {
  it('should disable AutoRun when launching Command Prompt on Windows', () => {
    expect(getDefaultShellArgs('C:\\Windows\\System32\\cmd.exe', Platform.Windows)).toEqual(['/d']);
  });

  it('should not add extra args for PowerShell on Windows', () => {
    expect(getDefaultShellArgs('C:\\Program Files\\PowerShell\\7\\pwsh.exe', Platform.Windows)).toEqual([]);
  });
});
