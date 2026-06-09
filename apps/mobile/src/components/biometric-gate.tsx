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
import { DEFAULT_PREFERENCES } from '@termlnk/database-mobile';
import { Lock } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { useBiometricService, useObservable, usePreferencesService } from '../core/core-context';
import { useThemeColors } from '../theme/theme-provider';

// App-lock overlay. When the user enables "require biometrics to open", the app blurs to a
// lock screen on enable and whenever it returns from the background; content is revealed
// only after a successful Face ID / Touch ID / passcode prompt. Independent of the master
// key auto-lock (which drops the key after 5 min and forces a full sign-in).
export function BiometricGate({ children }: { children: ReactNode }) {
  const prefsService = usePreferencesService();
  const prefs = useObservable(prefsService.prefs$, DEFAULT_PREFERENCES);
  const bio = useBiometricService();
  const colors = useThemeColors();
  const [locked, setLocked] = useState(false);
  const [authing, setAuthing] = useState(false);
  // Live hardware/enrollment state. The persisted biometricLock flag can outlive the
  // hardware (passcode removed, restored onto a device without biometrics); never engage
  // the lock when biometrics aren't usable, or the app would be impossible to unlock.
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    void prefsService.ready();
    void bio.getAvailability().then((a) => setAvailable(a.capability === 'available')).catch(() => setAvailable(false));
  }, [prefsService, bio]);

  const lockEnabled = prefs.biometricLock && available === true;

  useEffect(() => {
    if (!lockEnabled) {
      setLocked(false);
      return;
    }
    setLocked(true);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        setLocked(true);
      }
    });
    return () => sub.remove();
  }, [lockEnabled]);

  const unlock = useCallback(async () => {
    if (authing) {
      return;
    }
    setAuthing(true);
    try {
      const ok = await bio.authenticate('Unlock termlnk');
      if (ok) {
        setLocked(false);
      }
    } finally {
      setAuthing(false);
    }
  }, [bio, authing]);

  useEffect(() => {
    if (locked) {
      void unlock();
    }
    // unlock is intentionally omitted — re-running on every unlock identity change would
    // re-prompt mid-authentication. We only auto-prompt on the locked→true transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  if (!locked) {
    return <>{children}</>;
  }

  return (
    <View className="flex-1 items-center justify-center bg-surface">
      <Lock size={40} color={colors.contentTertiary} />
      <Text className="mt-4 text-[15px] text-content">termlnk is locked</Text>
      <Pressable onPress={unlock} className="mt-6 rounded-xl bg-accent px-6 py-3 active:opacity-80">
        <Text className="text-[15px] font-semibold text-accent-content">Unlock</Text>
      </Pressable>
    </View>
  );
}
