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

// P6.9-1 placeholder. SFTP browser will be rebuilt on top of
// @termlnk/react-native-russh in P6.9-7, sharing the SSH connection's channel
// via `connection.startSftp()` — no more dual-handshake against the legacy
// bridge. See docs/agent/cloud-sync-architecture.md §8.0 Phase 6 P6.9.

import type { IMobileHost } from '../../../src/sync/mobile-sync-pull.service';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSyncPullService } from '../../../src/core/core-context';

export default function SftpScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pull = useSyncPullService();

  const [host, setHost] = useState<IMobileHost | null>(null);

  useEffect(() => {
    const sub = pull.snapshot$.subscribe((snap) => {
      setHost(snap.hosts.find((h) => h.id === id) ?? null);
    });
    return () => sub.unsubscribe();
  }, [pull, id]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: host ? `${host.label} • SFTP` : 'SFTP' }} />
      <Text style={styles.title}>SFTP browser temporarily unavailable</Text>
      <Text style={styles.body}>
        The SFTP file browser is being rebuilt on top of
        `@termlnk/react-native-russh` (Rust russh + russh-sftp). Reconnecting
        in P6.9-7 lets the browser share the same SSH session as the terminal
        screen — one handshake, two channels.
      </Text>
      <Text style={styles.meta}>Host {host?.label ?? '—'} · {host?.addr ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a', padding: 24, gap: 12 },
  title: { color: '#e5e7eb', fontSize: 18, fontWeight: '600' },
  body: { color: '#9ca3af', fontSize: 14, lineHeight: 20 },
  meta: { color: '#6b7280', fontSize: 12, marginTop: 4 },
});
