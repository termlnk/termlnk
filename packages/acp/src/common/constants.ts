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

export const ACP_PLUGIN_NAME = 'ACP_PLUGIN';
export const ACP_CORE_PLUGIN_NAME = 'ACP_CORE_PLUGIN';

/**
 * Identity reported to agents in the ACP `initialize` handshake. This describes
 * this ACP client implementation*, not the shipped desktop app version — the
 * two are versioned independently, and acp-core has no access to Electron's
 * app.getVersion().
 */
export const ACP_CLIENT_NAME = 'termlnk';
export const ACP_CLIENT_VERSION = '1.0.0';

/** Session type registered with ITerminalViewRegistry. */
export const ACP_SESSION_TYPE = 'acp';

/** Default timeout for binary --version probes. */
export const DEFAULT_PROBE_TIMEOUT_MS = 3000;

/**
 * Deadline for the `initialize` + session handshake after the agent process is
 * spawned. Without it a binary that is on PATH but does not speak ACP (it
 * prints usage and exits) leaves the handshake promise pending forever, and the
 * caller never learns the session failed.
 */
export const DEFAULT_HANDSHAKE_TIMEOUT_MS = 15000;

/** Grace period before SIGKILL when terminating an agent process tree. */
export const AGENT_TERMINATE_GRACE_MS = 2000;
