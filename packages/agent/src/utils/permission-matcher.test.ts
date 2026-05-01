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

import type { IPermissionRule } from '../models/agent-tool-permission';
import { describe, expect, it } from 'vitest';
import { defaultFieldFor, matchPattern, matchRule } from './permission-matcher';

describe('matchPattern', () => {
  it('matches exact string', () => {
    expect(matchPattern('npm install', 'npm install')).toBe(true);
    expect(matchPattern('npm install', 'npm install lodash')).toBe(false);
  });

  it('matches prefix syntax foo:*', () => {
    expect(matchPattern('npm:*', 'npm')).toBe(true);
    expect(matchPattern('npm:*', 'npm install')).toBe(true);
    expect(matchPattern('npm:*', 'npm install lodash')).toBe(true);
    expect(matchPattern('npm:*', 'npmx run')).toBe(false);
    expect(matchPattern('git commit:*', 'git commit -m fix')).toBe(true);
    expect(matchPattern('git commit:*', 'git commitx')).toBe(false);
  });

  it('matches wildcard pattern', () => {
    expect(matchPattern('cat *.log', 'cat error.log')).toBe(true);
    expect(matchPattern('cat *.log', 'cat error.txt')).toBe(false);
    expect(matchPattern('rm */cache/*', 'rm /tmp/cache/foo')).toBe(true);
  });

  it('treats escaped star as literal', () => {
    expect(matchPattern('echo \\*', 'echo *')).toBe(true);
    expect(matchPattern('echo \\*', 'echo hi')).toBe(false);
  });

  it('escapes regex meta-characters in pattern', () => {
    expect(matchPattern('test (a.b)', 'test (a.b)')).toBe(true);
    expect(matchPattern('test (a.b)', 'test (axb)')).toBe(false);
  });
});

describe('matchRule', () => {
  const baseRule: IPermissionRule = {
    id: 'r1',
    toolName: 'termlnk_terminal_run',
    pattern: 'npm:*',
    decision: 'allow',
    scope: 'user',
    createdAt: 0,
  };

  it('matches by tool name + command field', () => {
    expect(matchRule(baseRule, 'termlnk_terminal_run', { command: 'npm install' })).toBe(true);
    expect(matchRule(baseRule, 'termlnk_terminal_run', { command: 'rm -rf /' })).toBe(false);
  });

  it('does not match different tool', () => {
    expect(matchRule(baseRule, 'termlnk_file_read', { command: 'npm install' })).toBe(false);
  });

  it('tool-level rule (no pattern) matches any input of that tool', () => {
    const toolRule: IPermissionRule = { ...baseRule, pattern: undefined };
    expect(matchRule(toolRule, 'termlnk_terminal_run', { command: 'anything' })).toBe(true);
    expect(matchRule(toolRule, 'termlnk_terminal_run', {})).toBe(true);
    expect(matchRule(toolRule, 'termlnk_file_read', { path: '/' })).toBe(false);
  });

  it('uses path field for file_* tools', () => {
    const fileRule: IPermissionRule = {
      ...baseRule,
      toolName: 'termlnk_file_read',
      pattern: '/Users/me/*',
    };
    expect(matchRule(fileRule, 'termlnk_file_read', { path: '/Users/me/foo.txt' })).toBe(true);
    expect(matchRule(fileRule, 'termlnk_file_read', { path: '/etc/passwd' })).toBe(false);
  });

  it('explicit matchField overrides default', () => {
    const customRule: IPermissionRule = {
      ...baseRule,
      toolName: 'termlnk_web_fetch',
      pattern: 'https://example.com/*',
      matchField: 'url',
    };
    expect(matchRule(customRule, 'termlnk_web_fetch', { url: 'https://example.com/api' })).toBe(true);
    expect(matchRule(customRule, 'termlnk_web_fetch', { url: 'https://other.com/api' })).toBe(false);
  });

  it('returns false when matched field is missing or non-string', () => {
    expect(matchRule(baseRule, 'termlnk_terminal_run', {})).toBe(false);
    expect(matchRule(baseRule, 'termlnk_terminal_run', { command: 123 })).toBe(false);
  });
});

describe('defaultFieldFor', () => {
  it('returns command for terminal tools', () => {
    expect(defaultFieldFor('termlnk_terminal_run')).toBe('command');
    expect(defaultFieldFor('termlnk_terminal_list_sessions')).toBe('command');
  });

  it('returns path for file tools', () => {
    expect(defaultFieldFor('termlnk_file_read')).toBe('path');
    expect(defaultFieldFor('termlnk_file_edit')).toBe('path');
  });

  it('returns url for web tools', () => {
    expect(defaultFieldFor('termlnk_web_fetch')).toBe('url');
  });

  it('returns command as fallback for unknown tools', () => {
    expect(defaultFieldFor('mcp_xyz_tool')).toBe('command');
    expect(defaultFieldFor('skill_foo')).toBe('command');
  });
});
