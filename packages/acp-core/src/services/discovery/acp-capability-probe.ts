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

import type {
  IACPProviderCapabilities,
  IACPProviderDescriptor,
} from '@termlnk/acp';
import type { ILogService } from '@termlnk/core';
import { homedir } from 'node:os';
import { generateRandomId } from '@termlnk/core';
import { ACPConnection } from '../session/acp-connection';

export interface IProbeCapabilitiesOptions {
  descriptor: IACPProviderDescriptor;
  env: Record<string, string>;
  handshakeTimeoutMs?: number;
}

/**
 * Starts the agent, reads what the session advertises, then shuts it down.
 *
 * ACP has no way to ask "what models do you have" without a session, so the only
 * honest answer costs a process. Bounded by the same handshake deadline as a real
 * session, and always disposed — a leaked probe is a stray agent process.
 */
export async function probeProviderCapabilities(
  options: IProbeCapabilitiesOptions,
  logService: ILogService
): Promise<IACPProviderCapabilities> {
  const connection = new ACPConnection(
    {
      sessionId: `acp_probe_${generateRandomId()}`,
      descriptor: options.descriptor,
      cwd: homedir(),
      env: options.env,
      providerTitle: options.descriptor.title,
      handshakeTimeoutMs: options.handshakeTimeoutMs,
    },
    logService
  );

  try {
    await connection.start();
    const info = connection.info;
    return {
      models: (info.availableModels ?? []).map((m) => ({ id: m.id, name: m.name })),
      modes: (info.availableModes ?? []).map((m) => ({ id: m.id, name: m.name })),
      probedAt: Date.now(),
    };
  } finally {
    connection.dispose();
  }
}
