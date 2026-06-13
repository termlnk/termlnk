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

import type { PortForwardingType } from '@termlnk/database-mobile';
import { Cloud, Flame, Server, Smartphone } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { useThemeColors } from '../theme/theme-provider';

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedPath = Animated.createAnimatedComponent(Path);

// ─── Layout constants ────────────────────────────────────────────────────
const CANVAS_H = 120;
const NODE_SIZE = 42;
const FIREWALL_W = 34;
const FIREWALL_H = 52;
const ICON_SIZE = 22;
const NODE_GAP = 32;
const RAIL_OFFSET = 3;
const HOST_ANCHOR_X = 22;
const HOST_EDGE_GAP = 12;

// ─── Animation timing (matches desktop) ──────────────────────────────────
const BLOCKED_DUR = 1200;
const RAIL_DRAW_DUR = 600;
const RAIL_START = BLOCKED_DUR;
const ENTRANCE_TOTAL = RAIL_START + RAIL_DRAW_DUR * 2;
const FLOW_SPEED = 150;

// ─── Type-specific accent colors ─────────────────────────────────────────
const ACCENT_COLORS: Record<PortForwardingType, string> = {
  local: '#61afef',
  remote: '#d19a66',
  dynamic: '#519aba',
};

const FIREWALL_COLOR = '#e06c75';

// ─── Node definitions ────────────────────────────────────────────────────
interface IDiagramNode {
  role: string;
  icon: 'smartphone' | 'firewall' | 'server' | 'cloud';
}

const NODES: Record<PortForwardingType, IDiagramNode[]> = {
  local: [
    { role: 'client', icon: 'smartphone' },
    { role: 'firewall', icon: 'firewall' },
    { role: 'host', icon: 'server' },
    { role: 'target', icon: 'server' },
  ],
  remote: [
    { role: 'client', icon: 'server' },
    { role: 'firewall', icon: 'firewall' },
    { role: 'host', icon: 'smartphone' },
    { role: 'target', icon: 'server' },
  ],
  dynamic: [
    { role: 'client', icon: 'smartphone' },
    { role: 'firewall', icon: 'firewall' },
    { role: 'host', icon: 'server' },
    { role: 'target', icon: 'cloud' },
    { role: 'targetAlt', icon: 'cloud' },
  ],
};

interface IPoint {
  x: number;
  y: number;
}

const POSITIONS: Record<PortForwardingType, Record<string, IPoint>> = {
  local: {
    client: { x: 21, y: 28 },
    firewall: { x: 50, y: 28 },
    host: { x: 50, y: 78 },
    target: { x: 79, y: 28 },
  },
  remote: {
    client: { x: 21, y: 28 },
    firewall: { x: 50, y: 28 },
    host: { x: 50, y: 78 },
    target: { x: 79, y: 28 },
  },
  dynamic: {
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
  local: [
    { from: 'client', to: 'host' },
    { from: 'host', to: 'target', dashed: true },
  ],
  remote: [
    { from: 'host', to: 'target' },
    { from: 'host', to: 'client', dashed: true },
  ],
  dynamic: [
    { from: 'client', to: 'host' },
    { from: 'host', to: 'target', dashed: true },
    { from: 'host', to: 'targetAlt', dashed: true },
  ],
};

const FLOW_PATHS: Record<PortForwardingType, string[][]> = {
  local: [['client', 'host', 'target']],
  remote: [['target', 'host', 'client']],
  dynamic: [
    ['client', 'host', 'target'],
    ['client', 'host', 'targetAlt'],
  ],
};

// ─── Geometry helpers ────────────────────────────────────────────────────

function toPixels(pct: IPoint, w: number): IPoint {
  return { x: (pct.x / 100) * w, y: (pct.y / 100) * CANVAS_H };
}

function shortenLine(from: IPoint, to: IPoint, gapFrom: number, gapTo?: number) {
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

function offsetLine(line: { x1: number; y1: number; x2: number; y2: number }, offset: number) {
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

function anchorForHost(hostPt: IPoint, otherPt: IPoint): IPoint {
  return {
    x: hostPt.x + (otherPt.x < hostPt.x ? -HOST_ANCHOR_X : HOST_ANCHOR_X),
    y: hostPt.y,
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

function buildFlowPoints(waypoints: string[], positions: Record<string, IPoint>, canvasWidth: number): IPoint[] {
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
  return pts;
}

// ─── Icon renderer ───────────────────────────────────────────────────────

function NodeIcon({ icon, color }: { icon: IDiagramNode['icon']; color: string }) {
  switch (icon) {
    case 'cloud':
      return <Cloud size={ICON_SIZE} color={color} />;
    case 'firewall':
      return <Flame size={ICON_SIZE} color="#e5c07b" />;
    case 'server':
      return <Server size={ICON_SIZE} color={color} />;
    case 'smartphone':
      return <Smartphone size={ICON_SIZE} color={color} />;
  }
}

// ─── Animated blocked line (Phase 1) ─────────────────────────────────────

function BlockedLine({ x1, y1, x2, y2, lineColor }: { x1: number; y1: number; x2: number; y2: number; lineColor: string }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: BLOCKED_DUR,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [len, 0, 0],
  });

  const stroke = progress.interpolate({
    inputRange: [0, 0.4, 0.55, 1],
    outputRange: [lineColor, lineColor, FIREWALL_COLOR, FIREWALL_COLOR],
  });

  const opacity = progress.interpolate({
    inputRange: [0, 0.55, 0.75, 1],
    outputRange: [1, 1, 0.9, 0],
  });

  return (
    <AnimatedLine
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      strokeWidth={2}
      strokeLinecap="round"
      strokeDasharray={[len]}
      strokeDashoffset={strokeDashoffset}
      stroke={stroke}
      opacity={opacity}
    />
  );
}

// ─── Animated rail pair (Phase 2) ────────────────────────────────────────

function RailPair({ line, dashed, delay, lineColor }: {
  line: { x1: number; y1: number; x2: number; y2: number };
  dashed: boolean;
  delay: number;
  lineColor: string;
}) {
  const r1 = offsetLine(line, RAIL_OFFSET);
  const r2 = offsetLine(line, -RAIL_OFFSET);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.timing(progress, {
        toValue: 1,
        duration: RAIL_DRAW_DUR,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, [progress, delay]);

  if (dashed) {
    const opacity = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });
    return (
      <>
        <AnimatedLine
          x1={r1.x1}
          y1={r1.y1}
          x2={r1.x2}
          y2={r1.y2}
          stroke={lineColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={[4, 3]}
          opacity={opacity}
        />
        <AnimatedLine
          x1={r2.x1}
          y1={r2.y1}
          x2={r2.x2}
          y2={r2.y2}
          stroke={lineColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={[4, 3]}
          opacity={opacity}
        />
      </>
    );
  }

  const dx = r1.x2 - r1.x1;
  const dy = r1.y2 - r1.y1;
  const len = Math.sqrt(dx * dx + dy * dy);

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [len, 0],
  });

  return (
    <>
      <AnimatedLine
        x1={r1.x1}
        y1={r1.y1}
        x2={r1.x2}
        y2={r1.y2}
        stroke={lineColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={[len]}
        strokeDashoffset={dashOffset}
      />
      <AnimatedLine
        x1={r2.x1}
        y1={r2.y1}
        x2={r2.x2}
        y2={r2.y2}
        stroke={lineColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={[len]}
        strokeDashoffset={dashOffset}
      />
    </>
  );
}

// ─── Animated data flow (Phase 3) ────────────────────────────────────────

function DataFlowPath({ d, totalLen, delay, accentColor }: {
  d: string;
  totalLen: number;
  delay: number;
  accentColor: string;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const dashOffset = useRef(new Animated.Value(0)).current;
  const dur = (totalLen / FLOW_SPEED) * 1000;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();

      Animated.loop(
        Animated.timing(dashOffset, {
          toValue: -totalLen,
          duration: dur,
          easing: Easing.linear,
          useNativeDriver: false,
        })
      ).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, [opacity, dashOffset, delay, dur, totalLen]);

  const dashLen = totalLen * 0.06;
  const gapLen = totalLen * 0.94;

  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={accentColor}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeDasharray={[dashLen, gapLen]}
      strokeDashoffset={dashOffset}
      opacity={opacity}
    />
  );
}

// ─── Main component ──────────────────────────────────────────────────────

interface IDiagramFigureProps {
  readonly type: PortForwardingType;
}

export function DiagramFigure({ type }: IDiagramFigureProps) {
  const colors = useThemeColors();
  const [canvasWidth, setCanvasWidth] = useState(0);
  const nodes = NODES[type];
  const accentColor = ACCENT_COLORS[type];
  const lineColor = `${colors.contentTertiary}94`;

  return (
    <View
      key={type}
      className="mx-4 mt-4 overflow-hidden rounded-2xl bg-surface-raised"
      style={{
        height: CANVAS_H + NODE_SIZE,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
      }}
      onLayout={(e) => setCanvasWidth(e.nativeEvent.layout.width)}
    >
      {canvasWidth > 0 && (
        <View style={{ width: canvasWidth, height: CANVAS_H + NODE_SIZE }}>
          {/* SVG connections layer */}
          <Svg
            width={canvasWidth}
            height={CANVAS_H}
            viewBox={`0 0 ${canvasWidth} ${CANVAS_H}`}
            style={{ position: 'absolute', top: NODE_SIZE / 2 }}
          >
            <ConnectionsLayer
              type={type}
              canvasWidth={canvasWidth}
              lineColor={lineColor}
              accentColor={accentColor}
            />
          </Svg>

          {/* Node icons layer */}
          {nodes.map((node) => {
            const pos = POSITIONS[type][node.role];
            if (!pos) {
              return null;
            }
            const px = toPixels(pos, canvasWidth);
            const isFirewall = node.icon === 'firewall';
            const w = isFirewall ? FIREWALL_W : NODE_SIZE;
            const h = isFirewall ? FIREWALL_H : NODE_SIZE;
            return (
              <View
                key={node.role}
                style={{
                  position: 'absolute',
                  left: px.x - w / 2,
                  top: (px.y + NODE_SIZE / 2) - h / 2,
                  width: w,
                  height: h,
                  borderRadius: isFirewall ? 10 : 12,
                  backgroundColor: isFirewall ? FIREWALL_COLOR : colors.surfaceRaised,
                  borderWidth: isFirewall ? 0 : 1,
                  borderColor: isFirewall ? 'transparent' : colors.divider,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOpacity: isFirewall ? 0.15 : 0.1,
                  shadowRadius: isFirewall ? 12 : 8,
                  shadowOffset: { width: 0, height: 6 },
                }}
              >
                <NodeIcon icon={node.icon} color={colors.content} />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function ConnectionsLayer({ type, canvasWidth, lineColor, accentColor }: {
  type: PortForwardingType;
  canvasWidth: number;
  lineColor: string;
  accentColor: string;
}) {
  const positions = POSITIONS[type];
  const connections = CONNECTIONS[type];
  const flowPaths = FLOW_PATHS[type];

  // Phase 1: Blocked attempt
  const blockedSource = type === 'remote' ? 'target' : 'client';
  const blockedFrom = toPixels(positions[blockedSource], canvasWidth);
  const firewallPt = toPixels(positions.firewall, canvasWidth);
  const blocked = shortenLine(blockedFrom, firewallPt, NODE_GAP);

  return (
    <>
      <BlockedLine
        x1={blocked.x1}
        y1={blocked.y1}
        x2={blocked.x2}
        y2={blocked.y2}
        lineColor={lineColor}
      />

      {/* Phase 2: Rail pairs */}
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
        const delay = RAIL_START + (i === 0 ? 0 : RAIL_DRAW_DUR);
        return (
          <RailPair
            key={`${conn.from}-${conn.to}`}
            line={line}
            dashed={conn.dashed === true}
            delay={delay}
            lineColor={lineColor}
          />
        );
      })}

      {/* Phase 3: Data flow */}
      {flowPaths.map((waypoints, i) => {
        const pts = buildFlowPoints(waypoints, positions, canvasWidth);
        const d = pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
        const totalLen = polylineLength(pts);
        const delay = ENTRANCE_TOTAL + i * 300;
        return (
          <DataFlowPath
            key={waypoints.join('-')}
            d={d}
            totalLen={totalLen}
            delay={delay}
            accentColor={accentColor}
          />
        );
      })}
    </>
  );
}
