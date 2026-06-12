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

import { LocaleService } from '@termlnk/core';
import { cn, useDependency } from '@termlnk/design';
import { PortForwardingType } from '@termlnk/rpc';
import { Cloud, Flame, Laptop, Router, Server } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';

export interface IDiagramFigureProps {
  type: PortForwardingType;
}

interface IDiagramNode {
  role: 'client' | 'firewall' | 'host' | 'target' | 'targetAlt';
  icon: 'cloud' | 'firewall' | 'laptop' | 'router' | 'server';
  label: string;
  labelKey?: string;
}

interface IPoint {
  x: number;
  y: number;
}

interface ILine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const CANVAS_H = 150;
const NODE_GAP = 40;
const RAIL_OFFSET = 3.5;
const BLOCKED_DUR = 1.2;
const RAIL_DRAW_DUR = 0.6;
const RAIL_START = BLOCKED_DUR;
const ENTRANCE_TOTAL = RAIL_START + RAIL_DRAW_DUR * 2;
const FLOW_SPEED = 150;

const NODE_BY_TYPE: Record<PortForwardingType, IDiagramNode[]> = {
  [PortForwardingType.LOCAL]: [
    { role: 'client', icon: 'laptop', label: 'Local listener', labelKey: 'port-forwarding-ui.diagram.localMachine' },
    { role: 'firewall', icon: 'firewall', label: 'SSH boundary' },
    { role: 'host', icon: 'server', label: 'Remote host', labelKey: 'port-forwarding-ui.diagram.intermediateHost' },
    { role: 'target', icon: 'server', label: 'Target service', labelKey: 'port-forwarding-ui.diagram.target' },
  ],
  [PortForwardingType.REMOTE]: [
    { role: 'client', icon: 'server', label: 'Remote listener', labelKey: 'port-forwarding-ui.diagram.target' },
    { role: 'firewall', icon: 'firewall', label: 'SSH boundary' },
    { role: 'host', icon: 'laptop', label: 'Reverse tunnel', labelKey: 'port-forwarding-ui.diagram.localMachine' },
    { role: 'target', icon: 'server', label: 'Local target', labelKey: 'port-forwarding-ui.diagram.remoteHost' },
  ],
  [PortForwardingType.DYNAMIC]: [
    { role: 'client', icon: 'laptop', label: 'Local SOCKS proxy', labelKey: 'port-forwarding-ui.diagram.localMachine' },
    { role: 'firewall', icon: 'firewall', label: 'SSH boundary' },
    { role: 'host', icon: 'server', label: 'SOCKS router', labelKey: 'port-forwarding-ui.diagram.intermediateHost' },
    { role: 'target', icon: 'cloud', label: 'Any target', labelKey: 'port-forwarding-ui.diagram.target' },
    { role: 'targetAlt', icon: 'cloud', label: 'Any target', labelKey: 'port-forwarding-ui.diagram.target' },
  ],
};

const NODE_POSITIONS: Record<PortForwardingType, Record<string, IPoint>> = {
  [PortForwardingType.LOCAL]: {
    client: { x: 21, y: 28 },
    firewall: { x: 50, y: 28 },
    host: { x: 50, y: 78 },
    target: { x: 79, y: 28 },
  },
  [PortForwardingType.REMOTE]: {
    client: { x: 21, y: 28 },
    firewall: { x: 50, y: 28 },
    host: { x: 50, y: 78 },
    target: { x: 79, y: 28 },
  },
  [PortForwardingType.DYNAMIC]: {
    client: { x: 21, y: 28 },
    firewall: { x: 50, y: 28 },
    host: { x: 50, y: 78 },
    target: { x: 77, y: 28 },
    targetAlt: { x: 77, y: 78 },
  },
};

interface IConnection {
  from: string;
  to: string;
  dashed?: boolean;
}

const CONNECTIONS: Record<PortForwardingType, IConnection[]> = {
  [PortForwardingType.LOCAL]: [{ from: 'client', to: 'host' }, { from: 'host', to: 'target', dashed: true }],
  [PortForwardingType.REMOTE]: [{ from: 'host', to: 'target' }, { from: 'host', to: 'client', dashed: true }],
  [PortForwardingType.DYNAMIC]: [{ from: 'client', to: 'host' }, { from: 'host', to: 'target', dashed: true }, { from: 'host', to: 'targetAlt', dashed: true }],
};

const FLOW_PATHS: Record<PortForwardingType, string[][]> = {
  [PortForwardingType.LOCAL]: [['client', 'host', 'target']],
  [PortForwardingType.REMOTE]: [['target', 'host', 'client']],
  [PortForwardingType.DYNAMIC]: [
    ['client', 'host', 'target'],
    ['client', 'host', 'targetAlt'],
  ],
};

function toPixels(pct: IPoint, w: number): IPoint {
  return { x: (pct.x / 100) * w, y: (pct.y / 100) * CANVAS_H };
}

function shortenLine(from: IPoint, to: IPoint, gapFrom: number, gapTo?: number): ILine {
  const gt = gapTo ?? gapFrom;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: from.x + gapFrom * ux,
    y1: from.y + gapFrom * uy,
    x2: to.x - gt * ux,
    y2: to.y - gt * uy,
  };
}

function offsetLine(line: ILine, offset: number): ILine {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const px = (-dy / len) * offset;
  const py = (dx / len) * offset;
  return {
    x1: line.x1 + px,
    y1: line.y1 + py,
    x2: line.x2 + px,
    y2: line.y2 + py,
  };
}

function polylineLength(pts: IPoint[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

function DiagramIcon({ icon }: { icon: IDiagramNode['icon'] }) {
  if (icon === 'cloud') {
    return <Cloud className="tm:size-8" />;
  }
  if (icon === 'firewall') {
    return <Flame className="tm:size-8" />;
  }
  if (icon === 'router') {
    return <Router className="tm:size-8" />;
  }
  if (icon === 'server') {
    return <Server className="tm:size-8" />;
  }
  return <Laptop className="tm:size-8" />;
}

const HOST_ANCHOR_X = 28;
const HOST_EDGE_GAP = 14;

function anchorForHost(hostPt: IPoint, otherPt: IPoint): IPoint {
  return { x: hostPt.x + (otherPt.x < hostPt.x ? -HOST_ANCHOR_X : HOST_ANCHOR_X), y: hostPt.y };
}

function DiagramConnections({ type, canvasWidth }: { type: PortForwardingType; canvasWidth: number }) {
  const positions = NODE_POSITIONS[type];
  const connections = CONNECTIONS[type];
  const flowPaths = FLOW_PATHS[type];

  const blockedSource = type === PortForwardingType.REMOTE ? 'target' : 'client';
  const blockedFromPx = toPixels(positions[blockedSource], canvasWidth);
  const firewallPx = toPixels(positions.firewall, canvasWidth);
  const blocked = shortenLine(blockedFromPx, firewallPx, NODE_GAP);

  return (
    <svg data-diagram-svg="" viewBox={`0 0 ${canvasWidth} ${CANVAS_H}`}>
      {/* Phase 1: Blocked attempt — client → firewall, turns red */}
      <line
        x1={blocked.x1}
        y1={blocked.y1}
        x2={blocked.x2}
        y2={blocked.y2}
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={1}
        data-diagram-blocked=""
      />

      {/* Phase 2: Port-forwarding rails draw sequentially */}
      {connections.map((conn, i) => {
        let from = toPixels(positions[conn.from], canvasWidth);
        let to = toPixels(positions[conn.to], canvasWidth);
        let gapFrom = NODE_GAP;
        let gapTo = NODE_GAP;
        if (conn.from === 'host') {
          from = anchorForHost(from, to);
          gapFrom = HOST_EDGE_GAP;
        }
        if (conn.to === 'host') {
          to = anchorForHost(to, from);
          gapTo = HOST_EDGE_GAP;
        }
        const line = shortenLine(from, to, gapFrom, gapTo);
        const r1 = offsetLine(line, RAIL_OFFSET);
        const r2 = offsetLine(line, -RAIL_OFFSET);
        const delay = RAIL_START + (i === 0 ? 0 : RAIL_DRAW_DUR);
        const railAttr = conn.dashed ? 'data-diagram-rail-dashed' : 'data-diagram-rail';
        const railProps = conn.dashed
          ? { pathLength: 1, strokeDasharray: '0.05 0.04' }
          : { pathLength: 1, strokeDasharray: '1', strokeDashoffset: 1 };

        return (
          <g key={`${conn.from}-${conn.to}`}>
            <line
              x1={r1.x1}
              y1={r1.y1}
              x2={r1.x2}
              y2={r1.y2}
              stroke="var(--pf-line)"
              strokeWidth={2.5}
              strokeLinecap="round"
              {...{ [railAttr]: '' }}
              {...railProps}
              style={{ animationDelay: `${delay}s` }}
            />
            <line
              x1={r2.x1}
              y1={r2.y1}
              x2={r2.x2}
              y2={r2.y2}
              stroke="var(--pf-line)"
              strokeWidth={2.5}
              strokeLinecap="round"
              {...{ [railAttr]: '' }}
              {...railProps}
              style={{ animationDelay: `${delay}s` }}
            />
          </g>
        );
      })}

      {/* Phase 3: Data flow packets loop forever */}
      {flowPaths.map((waypoints, i) => {
        const pts: IPoint[] = [];
        for (let j = 0; j < waypoints.length; j++) {
          const role = waypoints[j];
          const pt = toPixels(positions[role], canvasWidth);
          if (role === 'host') {
            const prev = j > 0 ? toPixels(positions[waypoints[j - 1]], canvasWidth) : null;
            const next = j < waypoints.length - 1 ? toPixels(positions[waypoints[j + 1]], canvasWidth) : null;
            if (prev) {
              pts.push(anchorForHost(pt, prev));
            }
            if (next) {
              pts.push(anchorForHost(pt, next));
            }
          } else {
            pts.push(pt);
          }
        }
        const d = pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
        const totalLen = polylineLength(pts);
        const dur = totalLen / FLOW_SPEED;
        const delay = ENTRANCE_TOTAL + i * 0.3;

        return (
          <path
            key={waypoints.join('-')}
            d={d}
            pathLength={1}
            strokeDasharray="0.06 0.94"
            data-diagram-data-flow=""
            style={{
              animationDelay: `${delay}s, ${delay}s`,
              animationDuration: `0.3s, ${dur}s`,
            }}
          />
        );
      })}
    </svg>
  );
}

export function DiagramFigure({ type }: IDiagramFigureProps) {
  const nodes = NODE_BY_TYPE[type];
  const localeService = useDependency(LocaleService);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);

  useLayoutEffect(() => {
    if (canvasRef.current) {
      setCanvasWidth(canvasRef.current.clientWidth);
    }
  }, []);

  return (
    <div
      key={type}
      data-port-forwarding-diagram=""
      data-type={type}
      className={cn(
        'tm:relative tm:overflow-hidden tm:rounded-lg tm:border tm:border-line tm:bg-one-bg tm:px-5 tm:py-4'
      )}
    >
      <div data-diagram-aura="" />

      <div ref={canvasRef} data-diagram-canvas="">
        {canvasWidth > 0 && <DiagramConnections type={type} canvasWidth={canvasWidth} />}

        {nodes.map((node) => (
          <div key={node.role} data-diagram-node={node.role} aria-label={node.label}>
            <div data-diagram-node-shell={node.icon}>
              <DiagramIcon icon={node.icon} />
            </div>
            {node.labelKey && (
              <span data-diagram-node-label="">{localeService.t(node.labelKey)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
