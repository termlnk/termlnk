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
import { Kbd, KbdGroup, useDependency } from '@termlnk/design';
import { IShortcutService } from '@termlnk/ui';
import { useMemo } from 'react';

export function ShortcutsTab() {
  const localeService = useDependency(LocaleService);
  const shortcutService = useDependency(IShortcutService);

  const shortcuts = useMemo(() => {
    const all = shortcutService.getAllShortcuts();
    const grouped = new Map<string, typeof all>();

    for (const shortcut of all) {
      const group = shortcut.group || 'other';
      if (!grouped.has(group)) {
        grouped.set(group, []);
      }
      grouped.get(group)!.push(shortcut);
    }

    return grouped;
  }, [shortcutService]);

  return (
    <div className="tm:flex tm:flex-col tm:gap-4">
      {Array.from(shortcuts.entries(), ([group, items]) => (
        <div key={group} className="tm:flex tm:flex-col tm:gap-1">
          {items.map((shortcut) => {
            const display = shortcutService.getShortcutDisplay(shortcut);
            if (!display) return null;

            return (
              <div
                key={shortcut.id}
                className="
                  tm:flex tm:items-center tm:justify-between tm:rounded-sm tm:px-2 tm:py-1.5
                  tm:hover:bg-one-bg
                "
              >
                <span className="tm:text-xs tm:text-white">
                  {localeService.t(shortcut.description || shortcut.id)}
                </span>
                <KbdGroup>
                  {display.split('+').map((key) => (
                    <Kbd key={key.trim()} className="tm:text-white">
                      {key.trim()}
                    </Kbd>
                  ))}
                </KbdGroup>
              </div>
            );
          })}
        </div>
      ))}

      {shortcuts.size === 0 && (
        <div className="tm:py-8 tm:text-center tm:text-xs tm:text-grey-fg">
          {localeService.t('settings-ui.shortcuts.empty')}
        </div>
      )}
    </div>
  );
}
