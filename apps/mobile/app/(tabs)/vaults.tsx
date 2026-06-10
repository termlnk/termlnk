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

import { AuthState } from '@termlnk/auth';
import { SyncState } from '@termlnk/sync';
import { useRouter } from 'expo-router';
import { ArrowLeftRight, Braces, ChevronDown, Cloud, CloudOff, KeyRound, ScrollText, Server, ShieldCheck } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthState, useHostRepository, useKnownHostRepository, useObservable, useRecentSessionsRepository, useSyncService } from '../../src/core/core-context';
import { useThemeColors } from '../../src/theme/theme-provider';
import { Card } from '../../src/ui/card';
import { TAB_BAR_HEIGHT } from '../../src/ui/floating-tab-bar';
import { NavRow } from '../../src/ui/rows';
import { ScreenContainer } from '../../src/ui/screen-container';

export default function VaultsTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const hostRepo = useHostRepository();
  const knownHostRepo = useKnownHostRepository();
  const recentRepo = useRecentSessionsRepository();
  const syncService = useSyncService();
  const authState = useAuthState();

  const hosts = useObservable(hostRepo.hosts$, []);
  const knownHosts = useObservable(knownHostRepo.knownHosts$, []);
  const sessions = useObservable(recentRepo.sessions$, []);
  const syncState = useObservable(syncService.state$, SyncState.Disabled);

  useEffect(() => {
    void hostRepo.ready();
    void knownHostRepo.ready();
    void recentRepo.ready();
  }, [hostRepo, knownHostRepo, recentRepo]);

  const hostCount = hosts.filter((h) => h.type === 'host').length;
  const isAuthenticated = authState === AuthState.Authenticated;
  const cloudColor = isAuthenticated ? colors.contentSecondary : colors.contentTertiary;
  const CloudIcon = isAuthenticated ? Cloud : CloudOff;
  const chevronLabel = isAuthenticated
    ? (syncState === SyncState.Syncing ? 'Syncing' : 'Cloud sync')
    : 'Sign in';

  function onVaultMenuPress() {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    void syncService.pull();
  }

  return (
    <ScreenContainer>
      <View style={{ paddingTop: insets.top + 10 }} className="flex-row items-center justify-center pb-3">
        <CloudIcon size={22} color={cloudColor} strokeWidth={2.4} />
        <Text className="ml-3 text-[18px] font-semibold text-content">Personal Vault</Text>
        <Pressable
          accessibilityLabel={chevronLabel}
          hitSlop={10}
          onPress={onVaultMenuPress}
          className="ml-2 h-7 w-7 items-center justify-center rounded-full bg-surface-sunken active:opacity-75"
        >
          <ChevronDown size={16} color={colors.contentSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 24 }}>
        <Card dividerInset={64}>
          <NavRow
            leading={<Server size={24} color={colors.content} />}
            title="Hosts"
            value={String(hostCount)}
            onPress={() => router.push('/hosts')}
          />
          <NavRow
            leading={<KeyRound size={24} color={colors.content} />}
            title="Keychain"
            onPress={() => router.push('/vault/keychain')}
          />
          <NavRow
            leading={<ArrowLeftRight size={24} color={colors.content} />}
            title="Port Forwarding"
            onPress={() => router.push('/vault/port-forwarding')}
          />
          <NavRow
            leading={<Braces size={24} color={colors.content} />}
            title="Snippets"
            onPress={() => router.push('/vault/snippets')}
          />
          <NavRow
            leading={<ShieldCheck size={24} color={colors.content} />}
            title="Known Hosts"
            value={String(knownHosts.length)}
            onPress={() => router.push('/vault/known-hosts')}
          />
          <NavRow
            leading={<ScrollText size={24} color={colors.content} />}
            title="Logs"
            value={String(sessions.length)}
            onPress={() => router.push('/vault/logs')}
          />
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}
