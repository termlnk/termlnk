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

import type { ILogService } from '@termlnk/core';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupLegacyAgentHooks, stripKimiHookBlock } from './legacy-agent-hook-cleanup';

const MARKER_CMD = '\'/home/u/.config/termlnk/bin/termlnk-hook\' --agent x --event stop # TERMLNK_HOOK';
const FOREIGN_CMD = '/usr/local/bin/my-hook --flag';

function makeLog(): ILogService {
  return { debug: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn(), deprecate: vi.fn(), setLogLevel: vi.fn() } as unknown as ILogService;
}

let home: string;
let configPath: string;
let log: ILogService;

function write(rel: string, content: string): string {
  const full = join(home, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  return full;
}

function read(rel: string): string {
  return readFileSync(join(home, rel), 'utf-8');
}

function run(env: Record<string, string | undefined> = {}): boolean {
  return cleanupLegacyAgentHooks({ homeDir: home, configPath, env, logService: log });
}

function nested(command: string, matcher?: string): Record<string, unknown> {
  return { ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command, timeout: 10 }] };
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'termlnk-cleanup-'));
  configPath = join(home, '.config', 'termlnk');
  log = makeLog();
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

describe('legacy agent hook cleanup: nested JSON agents', () => {
  const nestedAgents: Array<[string, string]> = [
    ['claude-code', '.claude/settings.json'],
    ['gemini', '.gemini/settings.json'],
    ['copilot', '.copilot/config.json'],
    ['codebuddy', '.codebuddy/settings.json'],
    ['codex', '.codex/hooks.json'],
  ];

  it.each(nestedAgents)('%s: removes termlnk groups, keeps foreign entries and other keys', (_agent, rel) => {
    const original = {
      theme: 'dark',
      hooks: {
        Stop: [nested(MARKER_CMD), nested(FOREIGN_CMD)],
        SessionStart: [nested(MARKER_CMD)],
        PreToolUse: [nested(MARKER_CMD, 'Bash')],
      },
    };
    write(rel, `${JSON.stringify(original, null, 2)}\n`);

    run();

    expect(JSON.parse(read(rel))).toEqual({
      theme: 'dark',
      hooks: { Stop: [nested(FOREIGN_CMD)] },
    });
    expect(read(rel).endsWith('\n')).toBe(true);
  });

  it('removes only the marked hook inside a mixed group', () => {
    write('.claude/settings.json', JSON.stringify({
      hooks: {
        Stop: [{ matcher: '*', hooks: [{ type: 'command', command: MARKER_CMD }, { type: 'command', command: FOREIGN_CMD }] }],
      },
    }));

    run();

    expect(JSON.parse(read('.claude/settings.json'))).toEqual({
      hooks: { Stop: [{ matcher: '*', hooks: [{ type: 'command', command: FOREIGN_CMD }] }] },
    });
  });

  it('drops the hooks key when nothing else remains', () => {
    write('.gemini/settings.json', JSON.stringify({ model: 'm', hooks: { Stop: [nested(MARKER_CMD)] } }));

    run();

    expect(JSON.parse(read('.gemini/settings.json'))).toEqual({ model: 'm' });
  });

  it('preserves tab indentation and a missing trailing newline', () => {
    write('.claude/settings.json', `{\n\t"a": 1,\n\t"hooks": {\n\t\t"Stop": [{"hooks": [{"command": "${MARKER_CMD}"}]}]\n\t}\n}`);

    run();

    expect(read('.claude/settings.json')).toBe('{\n\t"a": 1\n}');
  });

  it('does not rewrite files without termlnk entries', () => {
    const rel = '.claude/settings.json';
    const original = `{"hooks":{"Stop":[{"hooks":[{"command":"${FOREIGN_CMD}"}]}]}}`;
    const full = write(rel, original);
    const before = statSync(full).mtimeMs;

    run();

    expect(read(rel)).toBe(original);
    expect(statSync(full).mtimeMs).toBe(before);
  });

  it('honors the CODEX_HOME override', () => {
    const codexHome = join(home, 'custom-codex');
    mkdirSync(codexHome, { recursive: true });
    writeFileSync(join(codexHome, 'hooks.json'), JSON.stringify({ hooks: { Stop: [nested(MARKER_CMD)] } }));
    write('.codex/hooks.json', JSON.stringify({ hooks: { Stop: [nested(MARKER_CMD)] } }));

    run({ CODEX_HOME: codexHome });

    expect(JSON.parse(readFileSync(join(codexHome, 'hooks.json'), 'utf-8'))).toEqual({});
    // The default location is not touched when the override is set.
    expect(JSON.parse(read('.codex/hooks.json')).hooks.Stop).toHaveLength(1);
  });

  it('writes through symlinks and keeps file mode', () => {
    const target = write('dotfiles/claude-settings.json', JSON.stringify({ hooks: { Stop: [nested(MARKER_CMD)] }, keep: true }));
    chmodSync(target, 0o600);
    mkdirSync(join(home, '.claude'), { recursive: true });
    symlinkSync(target, join(home, '.claude', 'settings.json'));

    run();

    expect(JSON.parse(readFileSync(target, 'utf-8'))).toEqual({ keep: true });
    expect(statSync(target).mode & 0o777).toBe(0o600);
    expect(statSync(join(home, '.claude', 'settings.json')).isFile()).toBe(true);
  });
});

describe('legacy agent hook cleanup: cursor flat format', () => {
  it('removes flat marker entries and keeps foreign ones and version', () => {
    write('.cursor/hooks.json', JSON.stringify({
      version: 1,
      hooks: {
        stop: [{ command: MARKER_CMD }, { command: FOREIGN_CMD }],
        beforeSubmitPrompt: [{ command: MARKER_CMD }],
      },
    }, null, 2));

    run();

    expect(JSON.parse(read('.cursor/hooks.json'))).toEqual({
      version: 1,
      hooks: { stop: [{ command: FOREIGN_CMD }] },
    });
  });
});

describe('legacy agent hook cleanup: kimi TOML', () => {
  const block = [
    '# === TERMLNK_HOOK_BEGIN ===',
    '',
    '[[hooks]]',
    '# TERMLNK_HOOK',
    'event = "Stop"',
    'command = \'"/x/termlnk-hook" --agent kimi-code --event stop\'',
    'timeout = 5',
    '# === TERMLNK_HOOK_END ===',
  ].join('\n');

  it('removes the block appended after user content', () => {
    write('.kimi/config.toml', `default_model = "k2"\n\n[[hooks]]\nevent = "Stop"\ncommand = "mine"\n\n${block}\n`);

    run();

    expect(read('.kimi/config.toml')).toBe('default_model = "k2"\n\n[[hooks]]\nevent = "Stop"\ncommand = "mine"\n');
  });

  it('keeps the text on both sides when the block sits in the middle', () => {
    expect(stripKimiHookBlock(`a = 1\n\n${block}\n\nb = 2\n`)).toBe('a = 1\n\nb = 2\n');
  });

  it('returns null when there is no block or the end marker is missing', () => {
    expect(stripKimiHookBlock('a = 1\n')).toBeNull();
    expect(stripKimiHookBlock('# === TERMLNK_HOOK_BEGIN ===\nfoo\n')).toBeNull();
  });

  it('leaves an empty file rather than deleting it', () => {
    write('.kimi/config.toml', `${block}\n`);

    run();

    expect(read('.kimi/config.toml')).toBe('');
  });
});

describe('legacy agent hook cleanup: opencode plugin', () => {
  const rel = '.config/opencode/plugins/termlnk-hooks.mjs';

  it('deletes the generated plugin', () => {
    write(rel, '// termlnk OpenCode hook plugin\n// TERMLNK_HOOK\nexport default {};\n');
    write('.config/opencode/plugins/other.mjs', 'export default {};\n');

    run();

    expect(existsSync(join(home, rel))).toBe(false);
    expect(existsSync(join(home, '.config/opencode/plugins/other.mjs'))).toBe(true);
  });

  it('keeps a same-named file that lacks the marker', () => {
    write(rel, 'export default {};\n');

    run();

    expect(existsSync(join(home, rel))).toBe(true);
  });
});

describe('legacy agent hook cleanup: launcher files', () => {
  it('removes launcher, helper, runtime.json and the legacy claude wrapper', () => {
    for (const name of ['termlnk-hook', 'termlnk-hook.cmd', 'hook-helper.js', 'claude']) {
      write(`.config/termlnk/bin/${name}`, 'x');
    }
    write('.config/termlnk/runtime.json', '{}');
    write('.config/termlnk/termlnk.db', 'db');

    run();

    expect(existsSync(join(configPath, 'bin'))).toBe(false);
    expect(existsSync(join(configPath, 'runtime.json'))).toBe(false);
    expect(read('.config/termlnk/termlnk.db')).toBe('db');
  });

  it('keeps bin/ when it holds unrelated files', () => {
    write('.config/termlnk/bin/termlnk-hook', 'x');
    write('.config/termlnk/bin/custom-tool', 'y');

    run();

    expect(readdirSync(join(configPath, 'bin'))).toEqual(['custom-tool']);
  });

  it('cleans a separate configPath (web server)', () => {
    configPath = join(home, '.config', 'termlnk-web');
    write('.config/termlnk-web/bin/hook-helper.js', 'x');
    write('.config/termlnk-web/runtime.json', '{}');

    run();

    expect(existsSync(join(configPath, 'runtime.json'))).toBe(false);
    expect(existsSync(join(configPath, 'bin', 'hook-helper.js'))).toBe(false);
  });
});

describe('legacy agent hook cleanup: robustness', () => {
  it('is a no-op on an empty home', () => {
    expect(run()).toBe(true);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('logs and continues on malformed JSON without touching the file', () => {
    const broken = '{ "hooks": { oops ';
    write('.claude/settings.json', broken);
    write('.cursor/hooks.json', JSON.stringify({ hooks: { stop: [{ command: MARKER_CMD }] } }));

    // A failed step reports false so the caller retries on the next launch.
    expect(run()).toBe(false);

    expect(read('.claude/settings.json')).toBe(broken);
    expect(JSON.parse(read('.cursor/hooks.json'))).toEqual({});
    expect(log.warn).toHaveBeenCalledTimes(1);
  });

  it('ignores JSON files whose shape is unexpected', () => {
    write('.claude/settings.json', '[1,2,3]');
    write('.gemini/settings.json', JSON.stringify({ hooks: 'nope' }));
    write('.codex/hooks.json', JSON.stringify({ hooks: { Stop: 'nope' } }));

    run();

    expect(read('.claude/settings.json')).toBe('[1,2,3]');
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('is idempotent', () => {
    write('.claude/settings.json', JSON.stringify({ hooks: { Stop: [nested(MARKER_CMD), nested(FOREIGN_CMD)] } }, null, 2));
    write('.kimi/config.toml', 'a = 1\n\n# === TERMLNK_HOOK_BEGIN ===\n# === TERMLNK_HOOK_END ===\n');
    write('.config/termlnk/bin/termlnk-hook', 'x');

    run();
    const first = [read('.claude/settings.json'), read('.kimi/config.toml')];
    run();

    expect([read('.claude/settings.json'), read('.kimi/config.toml')]).toEqual(first);
    expect(first[1]).toBe('a = 1\n');
  });
});
