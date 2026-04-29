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

interface IBarChartData {
  label: string;
  value: number;
  color?: string;
}

interface IBarChartProps {
  title?: string;
  description?: string;
  data?: unknown;
  isStreaming?: boolean;
}

const DEFAULT_BAR_COLOR = 'var(--tm-blue)';

function normalizeData(raw: unknown): IBarChartData[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: IBarChartData[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const r = item as Record<string, unknown>;
    const label = typeof r.label === 'string' ? r.label : '';
    const value = typeof r.value === 'number' && Number.isFinite(r.value) ? r.value : Number.NaN;
    if (!label || !Number.isFinite(value)) {
      continue;
    }
    const color = typeof r.color === 'string' ? r.color : undefined;
    out.push({ label, value, color });
  }
  return out;
}

export const BarChartWidget = memo(function BarChartWidget({
  title,
  description,
  data,
  isStreaming = false,
}: IBarChartProps) {
  const bars = useMemo(() => normalizeData(data), [data]);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const max = bars.reduce((m, d) => Math.max(m, d.value), 0);
  const isEmpty = bars.length === 0;

  return (
    <div className="tm:my-3 tm:w-full" data-testid="bar-chart-widget">
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
          <div className="tm:flex tm:flex-col tm:gap-2 tm:rounded-lg tm:border tm:border-line tm:bg-one-bg tm:p-4">
            {bars.map((b, i) => {
              const pct = max > 0 ? (b.value / max) * 100 : 0;
              const color = b.color || DEFAULT_BAR_COLOR;
              const isHover = hoverIdx === i;
              return (
                <div
                  key={`b-${i}`}
                  className="tm:flex tm:items-center tm:gap-2"
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  <div className="tm:w-24 tm:shrink-0 tm:truncate tm:text-xs tm:text-light-grey">
                    {b.label}
                  </div>
                  <div className="tm:relative tm:h-5 tm:flex-1 tm:rounded-sm tm:bg-black2">
                    <div
                      className="tm:h-full tm:rounded-sm"
                      style={{
                        width: `${pct}%`,
                        background: color,
                        opacity: isHover ? 1 : 0.85,
                        transition: 'width 200ms ease, opacity 120ms ease',
                      }}
                    />
                  </div>
                  <div className="tm:w-16 tm:shrink-0 tm:text-right tm:text-xs tm:text-grey-fg2">
                    {b.value}
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
});
