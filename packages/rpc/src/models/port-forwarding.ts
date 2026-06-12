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

export enum PortForwardingType {
  LOCAL = 'local',
  REMOTE = 'remote',
  DYNAMIC = 'dynamic',
}

export enum PortForwardingTunnelStatus {
  IDLE = 'idle',
  STARTING = 'starting',
  AUTHENTICATING = 'authenticating',
  ACTIVE = 'active',
  FAILED = 'failed',
  STOPPING = 'stopping',
  CLOSED = 'closed',
}

export interface IPortForwardingRule {
  id: string;
  label: string;
  type: PortForwardingType;
  hostId: string;
  bindAddress: string;
  bindPort: number;
  destinationAddress?: string | null;
  destinationPort?: number | null;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

export interface IPortForwardingRuleCreateInput {
  label?: string;
  type: PortForwardingType;
  hostId: string;
  bindAddress?: string;
  bindPort: number;
  destinationAddress?: string | null;
  destinationPort?: number | null;
}

export interface IPortForwardingRuleUpdateInput {
  label?: string;
  type?: PortForwardingType;
  hostId?: string;
  bindAddress?: string;
  bindPort?: number;
  destinationAddress?: string | null;
  destinationPort?: number | null;
}

export interface IPortForwardingRuntimeState {
  ruleId: string;
  status: PortForwardingTunnelStatus;
  error?: string;
  effectiveBindPort?: number;
  startedAt?: number;
  activeConnections: number;
  totalConnections: number;
  bytesIn: number;
  bytesOut: number;
  bytesInRate: number;
  bytesOutRate: number;
}

export type PortForwardingAuthEvent =
  | { ruleId: string; type: 'keyboard_interactive'; name: string; instructions: string; prompts: Array<{ prompt: string; echo: boolean }>; viaHopId?: string; viaHopLabel?: string }
  | { ruleId: string; type: 'change_password'; message: string; viaHopId?: string; viaHopLabel?: string }
  | { ruleId: string; type: 'banner'; message: string; viaHopId?: string; viaHopLabel?: string }
  | { ruleId: string; type: 'auth_failed'; message: string; viaHopId?: string; viaHopLabel?: string }
  | { ruleId: string; type: 'host_key_prompt'; algorithm: string; fingerprint: string; changed: boolean; knownFingerprint?: string };

export type PortForwardingHostKeyAction = 'accept_save' | 'accept_once' | 'reject';
