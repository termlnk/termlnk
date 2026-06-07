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
import type { IBiometricAvailability } from '../../src/platform/biometric.service';
import { SyncState } from '@termlnk/sync';
import { useRouter } from 'expo-router';
import { ChevronRight, Minus, Plus, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useAuthService, useCurrentUser, useObservable, usePreferencesService, useSyncService } from '../../src/core/core-context';
import { BiometricService } from '../../src/platform/biometric.service';
import { DEFAULT_PREFERENCES } from '../../src/platform/mobile-preferences.service';
import { ScreenContainer } from '../../src/ui/screen-container';

const SYNC_STATE_LABEL: Record<SyncState, string> = {
  [SyncState.Disabled]: 'Disabled',
  [SyncState.Idle]: 'Up to date',
  [SyncState.Syncing]: 'Syncing…',
  [SyncState.Offline]: 'Offline',
  [SyncState.Error]: 'Error',
};

const FONT_MIN = 9;
const FONT_MAX = 22;

export default function SettingsTab() {
  const user = useCurrentUser();
  const auth = useAuthService();
  const sync = useSyncService();
  const prefsService = usePreferencesService();
  const router = useRouter();
  const syncState = useObservable(sync.state$, SyncState.Disabled);
  const prefs = useObservable(prefsService.prefs$, DEFAULT_PREFERENCES);
  const [biometric, setBiometric] = useState<IBiometricAvailability | null>(null);

  useEffect(() => {
    void prefsService.ready();
    const service = new BiometricService();
    service.getAvailability().then(setBiometric).catch(() => setBiometric(null));
  }, [prefsService]);

  const biometricUsable = biometric?.capability === 'available';

  const onSignOut = useCallback(async () => {
    if (!auth) {
      return;
    }
    await auth.logout();
    router.replace('/login');
  }, [auth, router]);

  const setFontSize = useCallback((delta: number) => {
    const next = Math.min(FONT_MAX, Math.max(FONT_MIN, prefs.terminalFontSize + delta));
    void prefsService.update({ terminalFontSize: next });
  }, [prefs.terminalFontSize, prefsService]);

  return (
    <ScreenContainer>
      <ScrollView contentContainerClassName="px-4 py-4 pb-12">
        <Section title="Account">
          <Row label="Signed in as" value={user?.email ?? '—'} />
          <Row label="Display name" value={user?.displayName ?? '—'} />
          <Row label="Email verified" value={user?.emailVerified ? 'Yes' : 'No'} />
        </Section>

        <Section title="Terminal">
          <View className="flex-row items-center justify-between py-1">
            <Text className="text-[13px] text-grey-fg">Font size</Text>
            <View className="flex-row items-center">
              <Stepper icon={<Minus size={16} color="#6f737b" />} onPress={() => setFontSize(-1)} />
              <Text className="mx-3 w-7 text-center text-[14px] font-medium text-light-grey">{prefs.terminalFontSize}</Text>
              <Stepper icon={<Plus size={16} color="#6f737b" />} onPress={() => setFontSize(1)} />
            </View>
          </View>
        </Section>

        <Section title="AI Assistant">
          <Pressable onPress={() => router.push('/ai-settings')} className="flex-row items-center justify-between py-1.5 active:opacity-70">
            <View className="flex-row items-center">
              <Sparkles size={16} color="#de98fd" />
              <Text className="ml-2 text-[14px] text-light-grey">Provider &amp; API key</Text>
            </View>
            <ChevronRight size={18} color="#42464e" />
          </Pressable>
        </Section>

        <Section title="Security">
          {biometricUsable && (
            <View className="flex-row items-center justify-between py-1">
              <Text className="text-[14px] text-light-grey">Require {biometric?.displayName ?? 'biometrics'} to open</Text>
              <Switch
                value={prefs.biometricLock}
                onValueChange={(v) => void prefsService.update({ biometricLock: v })}
                trackColor={{ false: '#353b45', true: '#61afef' }}
                thumbColor="#6f737b"
              />
            </View>
          )}
          <Row label="Auto-lock timeout" value="5 minutes (background)" />
          <Row label="Biometric available" value={biometric?.capability ?? 'checking…'} />
          <Text className="mt-2 text-[12px] leading-5 text-grey-fg">
            When the app spends more than 5 minutes off the foreground, the master key
            is dropped from memory and you sign in again on next launch.
          </Text>
        </Section>

        <Section title="Sync">
          <Row label="Status" value={SYNC_STATE_LABEL[syncState]} />
          <Text className="mt-2 text-[12px] leading-5 text-grey-fg">
            Hosts, identities, and keys sync end-to-end encrypted across your devices.
            Changes you make here are pushed to the cloud vault and pulled by your other
            clients automatically.
          </Text>
        </Section>

        <Section title="About">
          <Row label="Client" value="termlnk-mobile" />
          <Row label="Version" value="0.2.1" />
          <Row label="SSH backend" value="Rust russh 0.54 + russh-sftp 2 (uniffi-bindgen-react-native)" />
        </Section>

        <Pressable
          onPress={onSignOut}
          className="mt-4 items-center rounded-lg bg-one-bg py-3 active:bg-one-bg2"
        >
          <Text className="text-[14px] font-semibold text-red">Sign out</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

function Stepper({ icon, onPress }: { icon: ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="h-8 w-8 items-center justify-center rounded-md bg-one-bg2 active:bg-one-bg3">
      {icon}
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mb-6">
      <Text className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-grey-fg">
        {title}
      </Text>
      <View className="rounded-xl bg-one-bg p-3">{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-2">
      <Text className="text-[13px] text-grey-fg">{label}</Text>
      <Text
        numberOfLines={1}
        className="ml-3 max-w-[65%] text-right text-[13px] font-medium text-light-grey"
      >
        {value}
      </Text>
    </View>
  );
}
