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

import type { IBiometricAvailability } from '@termlnk/auth-mobile';
import { DEFAULT_PREFERENCES } from '@termlnk/database-mobile';
import { SyncState } from '@termlnk/sync';
import { useRouter } from 'expo-router';
import { Activity, Cpu, FlaskConical, Gauge, Hash, Keyboard, Languages, MapPin, Minus, Plus, RefreshCw, ScanFace, ShieldCheck, Sparkles, SquareChevronUp, Type } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthService, useBiometricService, useObservable, usePreferencesService, useSyncService } from '../src/core/core-context';
import { useThemeColors } from '../src/theme/theme-provider';
import { Card } from '../src/ui/card';
import { DangerButton } from '../src/ui/form';
import { IconTile } from '../src/ui/icon-tile';
import { NavRow, SwitchRow, ValueRow } from '../src/ui/rows';
import { ScreenContainer } from '../src/ui/screen-container';
import { ScreenHeader } from '../src/ui/screen-header';

const SYNC_STATE_LABEL: Record<SyncState, string> = {
  [SyncState.Disabled]: 'Disabled',
  [SyncState.Idle]: 'Up to date',
  [SyncState.Syncing]: 'Syncing…',
  [SyncState.Offline]: 'Offline',
  [SyncState.Error]: 'Error',
};

const FONT_MIN = 9;
const FONT_MAX = 22;
const SOON = (title: string) => () => Alert.alert(title, 'This setting is coming soon.');

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useAuthService();
  const sync = useSyncService();
  const prefsService = usePreferencesService();
  const bio = useBiometricService();
  const syncState = useObservable(sync.state$, SyncState.Disabled);
  const prefs = useObservable(prefsService.prefs$, DEFAULT_PREFERENCES);
  const [biometric, setBiometric] = useState<IBiometricAvailability | null>(null);

  useEffect(() => {
    void prefsService.ready();
    bio.getAvailability().then(setBiometric).catch(() => setBiometric(null));
  }, [prefsService, bio]);

  const biometricUsable = biometric?.capability === 'available';

  const onSignOut = useCallback(async () => {
    if (auth == null) {
      return;
    }
    await auth.logout();
    router.replace('/login');
  }, [auth, router]);

  const setFontSize = useCallback((delta: number) => {
    const next = Math.min(FONT_MAX, Math.max(FONT_MIN, prefs.terminalFontSize + delta));
    void prefsService.update({ terminalFontSize: next });
  }, [prefs.terminalFontSize, prefsService]);

  const toggle = (patch: Parameters<typeof prefsService.update>[0]) => () => void prefsService.update(patch);

  return (
    <ScreenContainer>
      <ScreenHeader variant="nav" title="Settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        <SectionTitle title="Keyboard" />
        <Card dividerInset={64}>
          <SwitchRow
            leading={<IconTile icon={SquareChevronUp} tone="sshid" />}
            title="Use Option as Meta Key"
            value={prefs.useOptionAsMeta}
            onValueChange={(v) => void prefsService.update({ useOptionAsMeta: v })}
          />
          <SwitchRow
            leading={<IconTile icon={Languages} tone="sessions" />}
            title="CJK Input In Terminal"
            description="Turn on to support CJK input with a hardware keyboard"
            value={prefs.cjkInput}
            onValueChange={(v) => void prefsService.update({ cjkInput: v })}
          />
          <NavRow leading={<IconTile icon={SquareChevronUp} tone="neutral" />} title="Remap Caps Lock" subtitle="None" onPress={SOON('Remap Caps Lock')} />
          <NavRow leading={<IconTile icon={Hash} tone="help" />} title="Hotkey for F1-F10" subtitle="Alt+Shift+<number>" onPress={SOON('Hotkey for F1-F10')} />
          <NavRow leading={<IconTile icon={Keyboard} tone="keychain" />} title="Customize Keyboard" onPress={SOON('Customize Keyboard')} />
          <NavRow leading={<IconTile icon={Gauge} tone="serial" />} title="Cursor Speed" subtitle="Normal" onPress={SOON('Cursor Speed')} />
        </Card>

        <SectionTitle title="Sessions" />
        <Card dividerInset={64}>
          <NavRow leading={<IconTile icon={Activity} tone="sessions" />} title="Live Activity" subtitle="Show sessions on lock screen" onPress={SOON('Live Activity')} />
          <NavRow
            leading={<IconTile icon={Cpu} tone="neutral" />}
            title="Detect Host Operating System"
            subtitle={prefs.detectHostOs ? 'Enabled' : 'Disabled'}
            onPress={toggle({ detectHostOs: !prefs.detectHostOs })}
          />
          <SwitchRow
            leading={<IconTile icon={FlaskConical} tone="help" />}
            title="Experimental Connection Process"
            description="Recommended for issues with VPN and cellular, but it can cause issues with background work."
            value={prefs.experimentalConnection}
            onValueChange={(v) => void prefsService.update({ experimentalConnection: v })}
          />
          <SwitchRow
            leading={<IconTile icon={ShieldCheck} tone="sshid" />}
            title="Post-Quantum Key Exchange"
            description="Turn off if you're experiencing issues with legacy devices."
            value={prefs.postQuantumKex}
            onValueChange={(v) => void prefsService.update({ postQuantumKex: v })}
          />
          <SwitchRow
            leading={<IconTile icon={MapPin} tone="keychain" />}
            title="Save Location Data"
            value={prefs.saveLocationData}
            onValueChange={(v) => void prefsService.update({ saveLocationData: v })}
          />
        </Card>

        <SectionTitle title="Terminal" />
        <Card dividerInset={64}>
          <FontSizeRow value={prefs.terminalFontSize} onDelta={setFontSize} />
        </Card>

        <SectionTitle title="Security" />
        <Card dividerInset={64}>
          {biometricUsable && (
            <SwitchRow
              leading={<IconTile icon={ScanFace} tone="discover" />}
              title={`Require ${biometric?.displayName ?? 'biometrics'} to open`}
              value={prefs.biometricLock}
              onValueChange={(v) => void prefsService.update({ biometricLock: v })}
            />
          )}
          <ValueRow title="Auto-lock timeout" value={`${prefs.autoLockMinutes} min (background)`} />
        </Card>
        <Text className="mt-2 px-4 text-[13px] leading-[18px] text-content-secondary">
          When the app spends more than
          {' '}
          {prefs.autoLockMinutes}
          {' '}
          minutes off the foreground, the master key is dropped from memory and you sign in again on next launch.
        </Text>

        <SectionTitle title="AI" />
        <Card dividerInset={64}>
          <NavRow leading={<IconTile icon={Sparkles} tone="ai" />} title="Provider & API key" onPress={() => router.push('/ai-settings')} />
        </Card>

        <SectionTitle title="Sync" />
        <Card dividerInset={64}>
          <ValueRow title="Status" value={SYNC_STATE_LABEL[syncState]} leading={<IconTile icon={RefreshCw} tone="known" />} />
        </Card>
        <Text className="mt-2 px-4 text-[13px] leading-[18px] text-content-secondary">
          Hosts, identities, and keys sync end-to-end encrypted across your devices.
        </Text>

        <View className="mt-6">
          <DangerButton title="Sign out" onPress={onSignOut} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text className="px-1 pb-2 pt-5 text-[12px] font-semibold uppercase tracking-wider text-content-tertiary">{title}</Text>
  );
}

function FontSizeRow({ value, onDelta }: { value: number; onDelta: (delta: number) => void }) {
  const colors = useThemeColors();
  return (
    <View className="flex-row items-center px-4 py-3">
      <View className="mr-3"><IconTile icon={Type} tone="serial" /></View>
      <Text className="flex-1 text-[16px] text-content">Font size</Text>
      <Pressable onPress={() => onDelta(-1)} className="h-8 w-8 items-center justify-center rounded-lg bg-surface-sunken active:opacity-70">
        <Minus size={16} color={colors.content} />
      </Pressable>
      <Text className="mx-3 w-7 text-center text-[16px] font-medium text-content">{value}</Text>
      <Pressable onPress={() => onDelta(1)} className="h-8 w-8 items-center justify-center rounded-lg bg-surface-sunken active:opacity-70">
        <Plus size={16} color={colors.content} />
      </Pressable>
    </View>
  );
}
