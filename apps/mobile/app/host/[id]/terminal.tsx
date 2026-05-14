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

// P6.9-1 placeholder. The terminal screen is being rebuilt on top of
// @termlnk/react-native-russh (Rust russh + uniffi-bindgen-react-native). The
// previous implementation, plus its NMSSH/JSch transport, was removed in this
// commit so the dependency graph no longer pulls in the legacy fork. The full
// terminal experience returns in P6.9-7 once the russh binding lands and the
// mobile SSH service is reconstructed on the russh API surface.

import type { IMobileHost } from '../../../src/sync/mobile-sync-pull.service';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSyncPullService } from '../../../src/core/core-context';

export default function TerminalScreen() {
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
      <Stack.Screen options={{ title: host ? `${host.label} • Terminal` : 'Terminal' }} />
      <Text style={styles.title}>Terminal temporarily unavailable</Text>
      <Text style={styles.body}>
        We are rebuilding the mobile terminal on a Rust russh backend
        (`@termlnk/react-native-russh`, plan P6.9). The previous NMSSH/JSch
        bridge has been removed so this build can ship with a single, audited
        SSH stack — see docs/agent/cloud-sync-architecture.md §8.0 Phase 6
        P6.9 for status.
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
