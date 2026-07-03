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

interface IShortcutRow {
  /** Unique row key — a command id paired with its description. */
  key: string;
  label: string;
  /** Every key combination bound to this row (e.g. ⌘1 … ⌘9). */
  displays: string[];
}

export function ShortcutsTab() {
  const localeService = useDependency(LocaleService);
  const shortcutService = useDependency(IShortcutService);

  const groups = useMemo(() => {
    const grouped = new Map<string, IShortcutRow[]>();

    for (const shortcut of shortcutService.getAllShortcuts()) {
      const display = shortcutService.getShortcutDisplay(shortcut);
      if (!display) {
        continue;
      }

      const groupKey = shortcut.group || 'other';
      let rows = grouped.get(groupKey);
      if (!rows) {
        rows = [];
        grouped.set(groupKey, rows);
      }

      // A command bound to several keys (e.g. Cmd+1..9 selecting tabs) registers one
      // shortcut per binding. Collapse them into a single row listing every combo.
      const label = shortcut.description || shortcut.id;
      const rowKey = `${shortcut.id}::${label}`;
      const existing = rows.find((row) => row.key === rowKey);
      if (existing) {
        if (!existing.displays.includes(display)) {
          existing.displays.push(display);
        }
      } else {
        rows.push({ key: rowKey, label, displays: [display] });
      }
    }

    return grouped;
  }, [shortcutService]);

  return (
    <div className="tm:flex tm:flex-col tm:gap-4">
      {Array.from(groups.entries(), ([group, rows]) => (
        <div key={group} className="tm:flex tm:flex-col tm:gap-1">
          {rows.map((row) => (
            <div
              key={row.key}
              className="
                tm:flex tm:items-center tm:justify-between tm:gap-4 tm:rounded-sm tm:px-2 tm:py-1.5
                tm:hover:bg-one-bg
              "
            >
              <span className="tm:text-xs tm:text-white">
                {localeService.t(row.label)}
              </span>
              <div className="tm:flex tm:flex-wrap tm:items-center tm:justify-end tm:gap-1.5">
                {row.displays.map((display) => (
                  <KbdGroup key={display}>
                    {display.split('+').map((key) => (
                      <Kbd key={key.trim()} className="tm:text-white">
                        {key.trim()}
                      </Kbd>
                    ))}
                  </KbdGroup>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {groups.size === 0 && (
        <div className="tm:py-8 tm:text-center tm:text-xs tm:text-grey-fg">
          {localeService.t('settings-ui.shortcuts.empty')}
        </div>
      )}
    </div>
  );
}
