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

import type { IMobileHost } from '../src/sync/mobile-sync-pull.service';
import { IMasterKeyService, ITokenStorageService } from '@termlnk/auth';
import { ILogService } from '@termlnk/core';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useAuthService, useCoreContext } from '../src/core/core-context';
import { MobileSyncPullService } from '../src/sync/mobile-sync-pull.service';

const CLIENT_ID = 'mobile-app';

export default function Hosts() {
  const { core } = useCoreContext();
  const auth = useAuthService();
  const router = useRouter();

  const pullService = useMemo(() => {
    const injector = core.getInjector();
    const masterKey = injector.get(IMasterKeyService);
    const tokenStorage = injector.get(ITokenStorageService);
    const logService = injector.get(ILogService);
    const cloudBaseUrl = typeof process.env.EXPO_PUBLIC_CLOUD_BASE_URL === 'string'
      ? process.env.EXPO_PUBLIC_CLOUD_BASE_URL
      : undefined;
    return new MobileSyncPullService(
      { cloudBaseUrl, clientId: CLIENT_ID },
      masterKey,
      tokenStorage,
      logService
    );
  }, [core]);

  const [hosts, setHosts] = useState<readonly IMobileHost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await pullService.pull();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pull failed');
    } finally {
      setLoading(false);
    }
  }, [pullService]);

  useEffect(() => {
    const sub = pullService.snapshot$.subscribe((snap) => setHosts(snap.hosts));
    onRefresh();
    return () => {
      sub.unsubscribe();
      pullService.dispose();
    };
  }, [pullService, onRefresh]);

  const onSignOut = useCallback(async () => {
    if (!auth) {
      return;
    }
    await auth.logout();
    router.replace('/login');
  }, [auth, router]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Hosts', headerRight: () => (
        <Pressable onPress={onSignOut} hitSlop={8}><Text style={styles.signOut}>Sign out</Text></Pressable>
      ) }} />
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={hosts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor="#e5e7eb" />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Text style={styles.rowMeta}>
              {item.type === 'group' ? 'Group' : `${item.addr ?? '?'}:${item.port ?? 22}`}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator color="#3b82f6" style={styles.empty} />
            : <Text style={styles.empty}>No hosts synced. Pull to refresh.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  list: { paddingVertical: 8 },
  row: { paddingHorizontal: 16, paddingVertical: 14, borderBottomColor: '#1f1f1f', borderBottomWidth: StyleSheet.hairlineWidth },
  rowLabel: { color: '#e5e7eb', fontSize: 15, fontWeight: '500' },
  rowMeta: { color: '#9ca3af', fontSize: 12, marginTop: 4 },
  empty: { color: '#9ca3af', textAlign: 'center', marginTop: 48, fontSize: 13 },
  signOut: { color: '#3b82f6', fontSize: 14, fontWeight: '500', paddingHorizontal: 12 },
  error: { color: '#f87171', textAlign: 'center', padding: 12, backgroundColor: '#1f0a0a' },
});
