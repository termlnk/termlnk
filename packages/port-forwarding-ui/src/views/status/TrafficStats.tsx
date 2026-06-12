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

export interface ITrafficStatsProps {
  bytesIn: number;
  bytesOut: number;
  bytesInRate: number;
  bytesOutRate: number;
  activeConnections: number;
}

function fmtBytes(n: number): string {
  if (n < 1024) {
    return `${n.toFixed(1)} B`;
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`;
  }
  if (n < 1024 * 1024 * 1024) {
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtRate(n: number): string {
  return `${fmtBytes(n)}/s`;
}

export function TrafficStats({ bytesIn, bytesOut, bytesInRate, bytesOutRate, activeConnections }: ITrafficStatsProps) {
  const showRate = bytesInRate > 1 || bytesOutRate > 1;
  return (
    <span
      className={`
        tm:inline-flex tm:min-w-0 tm:items-center tm:gap-1.5 tm:truncate tm:text-[11px]/4 tm:text-grey-fg2
        tm:tabular-nums
      `}
    >
      <span>{`↑ ${fmtBytes(bytesOut)}`}</span>
      <span>{`↓ ${fmtBytes(bytesIn)}`}</span>
      <span>{`${activeConnections} conns`}</span>
    </span>
  );
}
