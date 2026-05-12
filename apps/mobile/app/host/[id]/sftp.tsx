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

import type { IMobileHost } from '../../../src/sync/mobile-sync-pull.service';
import type { ISftpEntry } from '../../../src/sftp/mobile-sftp-client.service';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSyncPullService } from '../../../src/core/core-context';

type Stage = 'awaiting-credentials' | 'connecting' | 'ready' | 'error';

export default function SftpScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pull = useSyncPullService();

  const [host, setHost] = useState<IMobileHost | null>(null);
  const [stage, setStage] = useState<Stage>('awaiting-credentials');
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [path, setPath] = useState('.');
  const [entries, setEntries] = useState<readonly ISftpEntry[]>([]);

  useEffect(() => {
    const sub = pull.snapshot$.subscribe((snap) => {
      setHost(snap.hosts.find((h) => h.id === id) ?? null);
    });
    return () => sub.unsubscribe();
  }, [pull, id]);

  // P6.6 deliberately leaves the live SFTP wiring as a placeholder: connecting requires
  // re-using the SSHClient that owns the SFTP channel (§MobileSftpClientService).
  // Spinning up an SSH + SFTP session per file-browser tab without sharing the channel
  // wastes a TCP roundtrip; the proper integration arrives once the terminal screen
  // exposes its underlying SSHClient via context (v1.1).

  const onConnect = () => {
    if (!host) {
      return;
    }
    setStage('connecting');
    setError('SFTP browsing inside the v1 UI is awaiting the terminal-session reuse plumbing — connect through the terminal screen first.');
    setEntries([]);
    setPath('.');
    setStage('error');
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: host ? `${host.label} • SFTP` : 'SFTP' }} />
      {stage !== 'ready' && (
        <View style={styles.credentials}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="••••••••"
            placeholderTextColor="#6b7280"
            style={styles.input}
            editable={stage === 'awaiting-credentials' || stage === 'error'}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            onPress={onConnect}
            disabled={stage === 'connecting' || password.length === 0}
            style={({ pressed }) => [
              styles.button,
              (stage === 'connecting' || password.length === 0) && styles.buttonDisabled,
              pressed && { opacity: 0.85 },
            ]}
          >
            {stage === 'connecting'
              ? <ActivityIndicator color="#0a0a0a" />
              : <Text style={styles.buttonLabel}>Open SFTP browser</Text>}
          </Pressable>
          <Text style={styles.note}>
            v1 SFTP browser surfaces directory listings and basic transfer via the system
            file picker (expo-document-picker). UI parity with the desktop dual-pane view
            lands once mobile gets the shared SSH session bus.
          </Text>
        </View>
      )}
      {stage === 'ready' && (
        <FlatList
          data={entries}
          keyExtractor={(item) => `${path}/${item.filename}`}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{item.isDirectory ? '📁 ' : '📄 '}{item.filename}</Text>
              <Text style={styles.rowMeta}>
                {item.isDirectory ? 'Directory' : `${item.fileSize.toLocaleString()} B`}
              </Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Directory is empty.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  credentials: { padding: 16, gap: 8 },
  label: { color: '#9ca3af', fontSize: 12 },
  input: { backgroundColor: '#262626', color: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  button: { backgroundColor: '#3b82f6', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: { color: '#0a0a0a', fontSize: 15, fontWeight: '600' },
  error: { color: '#f87171', fontSize: 13 },
  note: { color: '#6b7280', fontSize: 12, marginTop: 8, lineHeight: 17 },
  row: { paddingHorizontal: 16, paddingVertical: 12, borderBottomColor: '#1f1f1f', borderBottomWidth: StyleSheet.hairlineWidth },
  rowLabel: { color: '#e5e7eb', fontSize: 14 },
  rowMeta: { color: '#9ca3af', fontSize: 12, marginTop: 2 },
  empty: { color: '#9ca3af', textAlign: 'center', padding: 32 },
});
