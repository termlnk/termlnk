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

import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { NotificationService } from './notification.service';

const noopLog = {
  debug: () => {},
  log: () => {},
  warn: () => {},
  error: () => {},
  deprecate: () => {},
  setLogLevel: () => {},
};

describe('NotificationService bell panel isolation', () => {
  it('forces agent notifications to transient and keeps them out of the bell list', async () => {
    const service = new NotificationService(noopLog as any);

    const agent = service.notify({
      title: 'Claude Code needs approval',
      body: 'Tool: Bash',
      source: 'agent',
      // Producers may forget transient — service must still exclude them.
      transient: false,
      showDesktop: false,
    });

    expect(agent.transient).toBe(true);
    expect(agent.source).toBe('agent');

    const list = await firstValueFrom(service.notifications$);
    expect(list).toHaveLength(0);
    expect(await firstValueFrom(service.unreadCount$)).toBe(0);
    expect(service.getNotifications()).toHaveLength(0);
    expect(service.getStats().total).toBe(0);

    service.dispose();
  });

  it('keeps system / application notifications in the bell list', async () => {
    const service = new NotificationService(noopLog as any);

    service.notify({
      title: 'New version available',
      body: 'Version 1.2.3 is ready to download.',
      source: 'system',
      showDesktop: false,
    });

    const list = await firstValueFrom(service.notifications$);
    expect(list).toHaveLength(1);
    expect(list[0]?.source).toBe('system');
    expect(await firstValueFrom(service.unreadCount$)).toBe(1);

    service.dispose();
  });
});
