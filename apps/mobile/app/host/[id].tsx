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

import type { IMobileHost } from '../../src/sync/mobile-sync-pull.service';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSyncPullService } from '../../src/core/core-context';

export default function HostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const pull = useSyncPullService();

  const [host, setHost] = useState<IMobileHost | null>(null);

  useEffect(() => {
    const sub = pull.hosts$.subscribe((hosts) => {
      setHost(hosts.find((h) => h.id === id) ?? null);
    });
    return () => sub.unsubscribe();
  }, [pull, id]);

  if (!host) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ title: 'Host' }} />
        <Text style={styles.error}>Host not found in current vault snapshot. Pull on the Hosts screen.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: host.label }} />
      <View style={styles.card}>
        <Text style={styles.label}>Address</Text>
        <Text style={styles.value}>{host.addr ?? '—'}</Text>
        <Text style={styles.label}>Port</Text>
        <Text style={styles.value}>{host.port ?? 22}</Text>
        <Text style={styles.label}>Type</Text>
        <Text style={styles.value}>{host.type}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.actionPrimary, pressed && styles.pressed]}
          onPress={() => router.push({ pathname: '/host/[id]/terminal', params: { id: host.id } })}
        >
          <Text style={styles.actionPrimaryLabel}>Open terminal</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionSecondary, pressed && styles.pressed]}
          onPress={() => router.push({ pathname: '/host/[id]/sftp', params: { id: host.id } })}
        >
          <Text style={styles.actionSecondaryLabel}>Browse files (SFTP)</Text>
        </Pressable>
      </View>

      <Text style={styles.note}>
        Credentials sync from your desktop vault end-to-end encrypted and live in this
        device's OS keystore. Tap Open terminal / Browse files to connect — no extra
        entry needed when a credential is on file.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  card: { backgroundColor: '#171717', borderRadius: 12, padding: 16, marginTop: 12 },
  label: { color: '#9ca3af', fontSize: 12, marginTop: 8 },
  value: { color: '#e5e7eb', fontSize: 16, marginTop: 2 },
  actions: { marginTop: 20, gap: 12 },
  actionPrimary: { backgroundColor: '#3b82f6', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  actionPrimaryLabel: { color: '#0a0a0a', fontSize: 15, fontWeight: '600' },
  actionSecondary: { backgroundColor: '#262626', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  actionSecondaryLabel: { color: '#e5e7eb', fontSize: 15, fontWeight: '500' },
  pressed: { opacity: 0.85 },
  note: { color: '#6b7280', fontSize: 12, marginTop: 16, lineHeight: 17 },
  error: { color: '#f87171', textAlign: 'center', padding: 24 },
});
