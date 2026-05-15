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

// SFTP screen. Opens its own SSH session and multiplexes an SFTP subsystem onto it
// via IMobileSshSession.openSftp(). Auto-connects from the vault credential when
// available; falls back to manual entry when missing.

import type { ISftpEntry } from '../../../src/sftp/mobile-sftp-client.service';
import type { IMobileSshSession } from '../../../src/ssh/mobile-ssh-client.service';
import type { IMobileHost } from '../../../src/sync/mobile-sync-pull.service';
import type { IHostConnectArgs } from '../../../src/ssh/auto-connect-from-vault';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCoreContext, useSyncPullService } from '../../../src/core/core-context';
import { MobileSftpClientService } from '../../../src/sftp/mobile-sftp-client.service';
import { autoConnectArgsFromVault } from '../../../src/ssh/auto-connect-from-vault';
import { MobileSshClientService } from '../../../src/ssh/mobile-ssh-client.service';
import { IMobileHostRepository } from '../../../src/storage/mobile-host-repository';

type Stage = 'loading-host' | 'awaiting-credentials' | 'connecting' | 'ready' | 'error';

interface ManualCredentials {
  username: string;
  password: string;
}

function entryKey(path: string, entry: ISftpEntry): string {
  return `${path}/${entry.filename}`;
}

function joinPath(base: string, segment: string): string {
  if (segment === '..') {
    const trimmed = base.replace(/\/+$/, '');
    const idx = trimmed.lastIndexOf('/');
    if (idx <= 0) {
      return '/';
    }
    return trimmed.slice(0, idx) || '/';
  }
  if (base === '/' || base === '.') {
    return `/${segment}`;
  }
  return `${base.replace(/\/+$/, '')}/${segment}`;
}

export default function SftpScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pull = useSyncPullService();
  const coreContext = useCoreContext();
  const hostRepo = useMemo(
    () => coreContext.core.getInjector().get(IMobileHostRepository),
    [coreContext]
  );

  const sshClient = useMemo(() => new MobileSshClientService(), []);
  const [host, setHost] = useState<IMobileHost | null>(null);
  const [stage, setStage] = useState<Stage>('loading-host');
  const [error, setError] = useState<string | null>(null);
  const [manualCreds, setManualCreds] = useState<ManualCredentials>({ username: '', password: '' });
  const [path, setPath] = useState('.');
  const [entries, setEntries] = useState<readonly ISftpEntry[]>([]);

  const [session, setSession] = useState<IMobileSshSession | null>(null);
  const [sftp, setSftp] = useState<MobileSftpClientService | null>(null);

  const autoConnectedRef = useRef(false);

  useEffect(() => {
    const sub = pull.hosts$.subscribe((hosts) => {
      setHost(hosts.find((h) => h.id === id) ?? null);
    });
    return () => sub.unsubscribe();
  }, [pull, id]);

  const connect = useCallback(async (args: IHostConnectArgs) => {
    if (!host) {
      return;
    }
    setStage('connecting');
    setError(null);
    try {
      const next = await sshClient.connect({
        ...args,
        hostId: host.id,
      });
      const client = new MobileSftpClientService(next);
      await client.connect();
      const initial = await client.list('.');
      setSession(next);
      setSftp(client);
      setPath('.');
      setEntries(initial);
      setStage('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setStage('error');
      autoConnectedRef.current = false;
    }
  }, [sshClient, host]);

  useEffect(() => {
    if (!host || autoConnectedRef.current) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const full = await hostRepo.getInfo(id);
        if (cancelled) {
          return;
        }
        if (full) {
          const auto = autoConnectArgsFromVault(full);
          if (auto) {
            autoConnectedRef.current = true;
            void connect(auto);
            return;
          }
        }
        setStage('awaiting-credentials');
      } catch (err) {
        if (cancelled) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to read host');
        setStage('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [host, hostRepo, id, connect]);

  useEffect(() => {
    return () => {
      if (sftp) {
        sftp.dispose();
      }
      if (session) {
        session.disconnect();
      }
      sshClient.dispose();
    };
  }, [sftp, session, sshClient]);

  const onConnectManual = async () => {
    if (!host || !host.addr) {
      setError('Host has no address');
      setStage('error');
      return;
    }
    if (!manualCreds.username || !manualCreds.password) {
      setError('Username and password are required');
      setStage('error');
      return;
    }
    await connect({
      host: host.addr,
      port: host.port ?? 22,
      username: manualCreds.username,
      password: manualCreds.password,
    });
  };

  const onEnter = async (entry: ISftpEntry) => {
    if (!sftp || !entry.isDirectory) {
      return;
    }
    const nextPath = joinPath(path, entry.filename);
    try {
      const next = await sftp.list(nextPath);
      setPath(nextPath);
      setEntries(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'List failed');
    }
  };

  const onGoUp = async () => {
    if (!sftp || path === '/' || path === '.') {
      return;
    }
    const nextPath = joinPath(path, '..');
    try {
      const next = await sftp.list(nextPath);
      setPath(nextPath);
      setEntries(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'List failed');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: host ? `${host.label} • SFTP` : 'SFTP' }} />
      {(stage === 'loading-host' || stage === 'connecting') && (
        <View style={styles.center}>
          <ActivityIndicator color="#3b82f6" />
          <Text style={styles.note}>
            {stage === 'loading-host' ? 'Loading host…' : `Opening SFTP on ${host?.label ?? 'host'}…`}
          </Text>
        </View>
      )}
      {(stage === 'awaiting-credentials' || stage === 'error') && (
        <View style={styles.credentials}>
          <Text style={styles.note}>
            {stage === 'error'
              ? 'Connection failed. Enter credentials manually to retry.'
              : 'No credential on file for this host. Enter manually to connect.'}
          </Text>
          <Text style={styles.label}>Username</Text>
          <TextInput
            value={manualCreds.username}
            onChangeText={(username) => setManualCreds((c) => ({ ...c, username }))}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="root"
            placeholderTextColor="#6b7280"
            style={styles.input}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={manualCreds.password}
            onChangeText={(password) => setManualCreds((c) => ({ ...c, password }))}
            secureTextEntry
            autoCapitalize="none"
            placeholder="••••••••"
            placeholderTextColor="#6b7280"
            style={styles.input}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            onPress={onConnectManual}
            disabled={manualCreds.username.length === 0 || manualCreds.password.length === 0}
            style={({ pressed }) => [
              styles.button,
              (manualCreds.username.length === 0 || manualCreds.password.length === 0) && styles.buttonDisabled,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.buttonLabel}>Open SFTP browser</Text>
          </Pressable>
        </View>
      )}
      {stage === 'ready' && (
        <View style={styles.browser}>
          <View style={styles.pathBar}>
            <Text style={styles.pathLabel}>{path}</Text>
            <Pressable onPress={onGoUp} style={({ pressed }) => [styles.upButton, pressed && { opacity: 0.85 }]}>
              <Text style={styles.upLabel}>..</Text>
            </Pressable>
          </View>
          <FlatList
            data={entries}
            keyExtractor={(item) => entryKey(path, item)}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onEnter(item)}
                disabled={!item.isDirectory}
                style={({ pressed }) => [styles.row, pressed && item.isDirectory && { backgroundColor: '#1f1f1f' }]}
              >
                <Text style={styles.rowLabel}>
                  {item.isDirectory ? '📁 ' : '📄 '}
                  {item.filename}
                </Text>
                <Text style={styles.rowMeta}>
                  {item.isDirectory ? 'Directory' : `${item.size.toString()} B`}
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.empty}>Directory is empty.</Text>}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  credentials: { padding: 16, gap: 8 },
  label: { color: '#9ca3af', fontSize: 12 },
  input: { backgroundColor: '#262626', color: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  button: { backgroundColor: '#3b82f6', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: { color: '#0a0a0a', fontSize: 15, fontWeight: '600' },
  error: { color: '#f87171', fontSize: 13 },
  note: { color: '#9ca3af', fontSize: 13, marginTop: 4, lineHeight: 18 },
  browser: { flex: 1 },
  pathBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomColor: '#1f1f1f', borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  pathLabel: { color: '#e5e7eb', fontSize: 14, flex: 1 },
  upButton: { backgroundColor: '#262626', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  upLabel: { color: '#e5e7eb', fontSize: 13, fontWeight: '600' },
  row: { paddingHorizontal: 16, paddingVertical: 12, borderBottomColor: '#1f1f1f', borderBottomWidth: StyleSheet.hairlineWidth },
  rowLabel: { color: '#e5e7eb', fontSize: 14 },
  rowMeta: { color: '#9ca3af', fontSize: 12, marginTop: 2 },
  empty: { color: '#9ca3af', textAlign: 'center', padding: 32 },
});
