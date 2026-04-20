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

import type { INotification } from '@termlnk/core';
import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react';

type TranslateFn = (key: string, ...args: string[]) => string;

export function getNotificationIcon(type: INotification['type']) {
  switch (type) {
    case 'success':
      return <CircleCheck className="tm:size-3 tm:text-green" />;
    case 'warning':
      return <TriangleAlert className="tm:size-3 tm:text-yellow" />;
    case 'error':
      return <CircleX className="tm:size-3 tm:text-red" />;
    case 'info':
    default:
      return <Info className="tm:size-3 tm:text-blue" />;
  }
}

export function getSourceLabel(source: INotification['source'], t: TranslateFn): string {
  const keyMap: Record<INotification['source'], string> = {
    terminal: 'ui.notification-panel.source.terminal',
    system: 'ui.notification-panel.source.system',
    extension: 'ui.notification-panel.source.extension',
    application: 'ui.notification-panel.source.application',
    agent: 'ui.notification-panel.source.agent',
  };

  return t(keyMap[source] ?? `ui.notification-panel.source.${source}`);
}
