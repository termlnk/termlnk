/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

// TypeScript facade for the Rust port forwarding API.

export interface ILocalForwardConfig {
  readonly bindAddress: string;
  readonly bindPort: number;
  readonly destinationAddress: string;
  readonly destinationPort: number;
}

export interface IRemoteForwardConfig {
  readonly bindAddress: string;
  readonly bindPort: number;
  readonly destinationAddress: string;
  readonly destinationPort: number;
}

export interface IDynamicForwardConfig {
  readonly bindAddress: string;
  readonly bindPort: number;
}

export type ForwardTunnelStatus =
  | { kind: 'starting' }
  | { kind: 'active'; effectiveBindPort: number }
  | { kind: 'failed'; error: string }
  | { kind: 'stopped' };

export interface IForwardTunnelStats {
  readonly status: ForwardTunnelStatus;
  readonly activeConnections: number;
  readonly totalConnections: number;
  readonly bytesIn: number;
  readonly bytesOut: number;
}

export interface IForwardTunnelCallback {
  onStatusChange(status: ForwardTunnelStatus): void;
  onStatsUpdate(stats: IForwardTunnelStats): void;
}

export interface IForwardHandle {
  stop(): Promise<void>;
  getStats(): IForwardTunnelStats;
}
