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

import type { IACPProviderDescriptor } from '@termlnk/acp';
import type { ILogService } from '@termlnk/core';
import { tmpdir } from 'node:os';
import process from 'node:process';
import { describe, expect, it } from 'vitest';
import { ACPConnection } from '../services/session/acp-connection';

const noopLog: ILogService = {
  log: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as unknown as ILogService;

function connect(
  command: IACPProviderDescriptor['command'],
  handshakeTimeoutMs: number
): ACPConnection {
  return new ACPConnection(
    {
      sessionId: 'acp_test',
      descriptor: {
        id: 'test-agent',
        title: 'Test Agent',
        description: 'fixture',
        command,
        source: 'catalog',
      },
      cwd: tmpdir(),
      env: { ...process.env } as Record<string, string>,
      providerTitle: 'Test Agent',
      handshakeTimeoutMs,
    },
    noopLog
  );
}

describe('aCPConnection handshake', () => {
  it('rejects when the agent exits before answering initialize', async () => {
    // A binary that is on PATH but does not speak ACP: it complains and exits.
    // The JSON-RPC request never settles on its own, so only the exit handler
    // can fail the handshake.
    const connection = connect(
      ['sh', '-c', 'echo "unknown option --acp" >&2; exit 2'],
      10_000
    );

    await expect(connection.start()).rejects.toThrow(/exited/);
    expect(connection.info.status).toBe('error');
    // The stderr tail is what tells the user what actually went wrong.
    expect(connection.info.errorMessage).toContain('unknown option --acp');

    connection.dispose();
  });

  it('rejects when the agent stays silent past the deadline', async () => {
    const connection = connect(['sh', '-c', 'sleep 30'], 150);

    await expect(connection.start()).rejects.toThrow(/timed out after 150ms/);
    expect(connection.info.status).toBe('error');

    connection.dispose();
  });
});
