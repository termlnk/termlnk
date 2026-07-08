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

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useColorScheme, View } from 'react-native';
import { usePreferencesService } from '../core/core-context';
import { DARK_VARS, LIGHT_VARS } from '../theme/theme-provider';

interface IPreferencesBootGateProps {
  readonly children: ReactNode;
}

/**
 * Blocks the app tree until IMobilePreferencesService has finished its first
 * load from SQLite. Without this gate the BehaviorSubject briefly emits its
 * DEFAULT_PREFERENCES value, ThemeProvider mounts against defaults, and the
 * screen flashes to the persisted theme on the next tick. The placeholder view
 * uses the OS scheme's surface color so the gate matches auto-mode users'
 * expectations even before their stored preference lands.
 */
export function PreferencesBootGate({ children }: IPreferencesBootGateProps) {
  const prefsService = usePreferencesService();
  const [ready, setReady] = useState(false);
  const scheme = useColorScheme();

  useEffect(() => {
    let cancelled = false;
    void prefsService.ready().finally(() => {
      if (!cancelled) {
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [prefsService]);

  if (!ready) {
    const surface = scheme === 'dark' ? DARK_VARS['--color-surface'] : LIGHT_VARS['--color-surface'];
    return <View style={{ flex: 1, backgroundColor: surface }} />;
  }

  return <>{children}</>;
}
