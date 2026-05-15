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
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useAuthService, useSyncPullService } from '../src/core/core-context';

export default function Hosts() {
  const auth = useAuthService();
  const router = useRouter();
  const pullService = useSyncPullService();

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
    const sub = pullService.hosts$.subscribe((next) => setHosts(next));
    onRefresh();
    // Pull service is a singleton inside CoreContext — do NOT dispose here, other
    // screens (host detail, settings) share the same snapshot stream.
    return () => {
      sub.unsubscribe();
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
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={8}
            style={({ pressed }) => pressed && { opacity: 0.7 }}
          >
            <Text style={styles.headerLink}>Settings</Text>
          </Pressable>
          <Pressable onPress={onSignOut} hitSlop={8}>
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
        </View>
      ) }} />
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={hosts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor="#e5e7eb" />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/host/[id]', params: { id: item.id } })}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Text style={styles.rowMeta}>
              {item.type === 'group' ? 'Group' : `${item.addr ?? '?'}:${item.port ?? 22}`}
            </Text>
          </Pressable>
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
  rowPressed: { backgroundColor: '#171717' },
  rowLabel: { color: '#e5e7eb', fontSize: 15, fontWeight: '500' },
  rowMeta: { color: '#9ca3af', fontSize: 12, marginTop: 4 },
  empty: { color: '#9ca3af', textAlign: 'center', marginTop: 48, fontSize: 13 },
  signOut: { color: '#3b82f6', fontSize: 14, fontWeight: '500', paddingHorizontal: 12 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerLink: { color: '#9ca3af', fontSize: 14, fontWeight: '500', paddingHorizontal: 12 },
  error: { color: '#f87171', textAlign: 'center', padding: 12, backgroundColor: '#1f0a0a' },
});
