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

import { memo, useMemo, useState } from 'react';

interface IPieChartData {
  label: string;
  value: number;
  color?: string;
}

interface IPieChartProps {
  title?: string;
  description?: string;
  data?: unknown;
  isStreaming?: boolean;
}

const DEFAULT_COLORS = [
  'var(--tm-blue)',
  'var(--tm-green)',
  'var(--tm-yellow)',
  'var(--tm-purple)',
  'var(--tm-cyan)',
  'var(--tm-orange)',
  'var(--tm-red)',
  'var(--tm-teal)',
  'var(--tm-pink)',
  'var(--tm-vibrant-green)',
];

function normalizeData(raw: unknown): IPieChartData[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: IPieChartData[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const r = item as Record<string, unknown>;
    const label = typeof r.label === 'string' ? r.label : '';
    const value = typeof r.value === 'number' && Number.isFinite(r.value) ? r.value : Number.NaN;
    if (!label || !Number.isFinite(value) || value < 0) {
      continue;
    }
    const color = typeof r.color === 'string' ? r.color : undefined;
    out.push({ label, value, color });
  }
  return out;
}

function polarToCartesian(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  if (endDeg - startDeg >= 359.999) {
    return `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 -${r * 2},0`;
  }
  const [sx, sy] = polarToCartesian(cx, cy, r, startDeg);
  const [ex, ey] = polarToCartesian(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx},${cy} L ${sx},${sy} A ${r},${r} 0 ${large} 1 ${ex},${ey} Z`;
}

export const PieChartWidget = memo(function PieChartWidget({
  title,
  description,
  data,
  isStreaming = false,
}: IPieChartProps) {
  const slices = useMemo(() => normalizeData(data), [data]);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const total = slices.reduce((s, d) => s + d.value, 0);
  const cx = 120;
  const cy = 120;
  const r = 96;

  let cursor = 0;
  const arcs = slices.map((d, i) => {
    const fraction = total > 0 ? d.value / total : 0;
    const start = cursor;
    const end = cursor + fraction * 360;
    cursor = end;
    return {
      ...d,
      start,
      end,
      fraction,
      color: d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    };
  });

  const isEmpty = slices.length === 0 || total <= 0;

  return (
    <div className="tm:my-3 tm:w-full" data-testid="pie-chart-widget">
      {(title || description) && (
        <div className="tm:mb-3 tm:px-1">
          {title && <h3 className="tm:text-sm tm:font-semibold tm:text-light-grey">{title}</h3>}
          {description && <p className="tm:mt-1 tm:text-xs tm:text-grey-fg">{description}</p>}
        </div>
      )}
      {isEmpty
        ? (
          <div className="tm:rounded-lg tm:border tm:border-line tm:bg-one-bg tm:p-4 tm:text-xs tm:text-grey-fg">
            {isStreaming ? '正在生成图表数据…' : '暂无数据'}
          </div>
        )
        : (
          <div className="tm:flex tm:items-center tm:gap-4 tm:rounded-lg tm:border tm:border-line tm:bg-one-bg tm:p-4">
            <svg width={240} height={240} viewBox="0 0 240 240" role="img">
              {arcs.map((a, i) => (
                <path
                  key={`s-${i}`}
                  d={arcPath(cx, cy, r, a.start, a.end)}
                  fill={a.color}
                  opacity={hoverIdx == null || hoverIdx === i ? 1 : 0.4}
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                  style={{ transition: 'opacity 120ms ease' }}
                />
              ))}
              <circle cx={cx} cy={cy} r={r * 0.55} fill="var(--tm-one-bg)" />
              {hoverIdx != null && arcs[hoverIdx] && (
                <g>
                  <text x={cx} y={cy - 4} textAnchor="middle" fontSize={14} fill="var(--tm-light-grey)">
                    {arcs[hoverIdx].label}
                  </text>
                  <text x={cx} y={cy + 14} textAnchor="middle" fontSize={11} fill="var(--tm-grey-fg2)">
                    {arcs[hoverIdx].value}
                    {' · '}
                    {(arcs[hoverIdx].fraction * 100).toFixed(1)}
                    %
                  </text>
                </g>
              )}
            </svg>
            <div className="tm:flex tm:flex-1 tm:flex-col tm:gap-1.5">
              {arcs.map((a, i) => (
                <button
                  key={`l-${i}`}
                  type="button"
                  className="
                    tm:flex tm:items-center tm:gap-2 tm:rounded-sm tm:bg-transparent tm:px-2 tm:py-1 tm:text-left
                    tm:text-xs tm:text-light-grey tm:transition-colors
                    tm:hover:bg-one-bg2
                  "
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  <span
                    className="tm:inline-block tm:size-3 tm:rounded-sm"
                    style={{ background: a.color }}
                  />
                  <span className="tm:flex-1 tm:truncate">{a.label}</span>
                  <span className="tm:text-grey-fg2">
                    {a.value}
                    {' · '}
                    {(a.fraction * 100).toFixed(0)}
                    %
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
    </div>
  );
});
