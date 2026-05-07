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

import { cn } from '@termlnk/design';
import { forwardRef } from 'react';

export type TimelineNodeVariant = 'local' | 'bastion' | 'add' | 'target';

export interface ITimelineNodeProps {
  variant: TimelineNodeVariant;
  showTopConnector?: boolean;
  showBottomConnector?: boolean;
  className?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const variantDotCls: Record<TimelineNodeVariant, string> = {
  local: 'tm:size-3 tm:rounded-full tm:bg-one-bg2 tm:ring-1 tm:ring-grey',
  bastion: 'tm:size-2.5 tm:rounded-full tm:bg-nord-blue',
  add: 'tm:size-2.5 tm:rounded-full tm:border tm:border-dashed tm:border-grey',
  target: 'tm:size-3.5 tm:rounded-full tm:bg-blue tm:ring-2 tm:ring-blue/30',
};

export const TimelineNode = forwardRef<HTMLDivElement, ITimelineNodeProps>(function TimelineNode(props, ref) {
  const { variant, showTopConnector = true, showBottomConnector = true, className, children, style } = props;

  return (
    <div ref={ref} className={cn('tm:relative tm:flex tm:items-stretch tm:gap-3', className)} style={style}>
      {/* Left rail: connector lines + dot */}
      <div className="tm:relative tm:flex tm:w-4 tm:flex-none tm:justify-center">
        {/* top connector */}
        <span
          className={cn(
            'tm:absolute tm:top-0 tm:left-1/2 tm:h-1/2 tm:w-px tm:-translate-x-1/2 tm:bg-line',
            { 'tm:hidden': !showTopConnector }
          )}
        />
        {/* bottom connector */}
        <span
          className={cn(
            'tm:absolute tm:bottom-0 tm:left-1/2 tm:h-1/2 tm:w-px tm:-translate-x-1/2 tm:bg-line',
            { 'tm:hidden': !showBottomConnector }
          )}
        />
        {/* dot */}
        <span
          className={cn(
            'tm:absolute tm:top-1/2 tm:left-1/2 tm:-translate-1/2',
            variantDotCls[variant]
          )}
        />
      </div>

      {/* Right content */}
      <div className="tm:min-w-0 tm:flex-1 tm:py-1">{children}</div>
    </div>
  );
});
