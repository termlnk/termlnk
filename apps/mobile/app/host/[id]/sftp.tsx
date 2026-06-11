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

// SFTP screen. Reuses the connection coordinator's SSH transport and multiplexes an SFTP
// subsystem onto it via IMobileSshSession.openSftp(). Auto-connects from the vault credential
// when available; falls back to manual entry when missing.

import type { IMobileHost } from '@termlnk/database-mobile';
import type { ISftpEntry, MobileSftpClientService } from '@termlnk/sftp-mobile';
import type { IMobileSshSession } from '@termlnk/terminal-mobile';
import * as DocumentPicker from 'expo-document-picker';
import { Paths } from 'expo-file-system';
import { Stack, useLocalSearchParams } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { ArrowUp, Download, File as FileIcon, Folder as FolderIcon, Upload } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useConnectionService, useRecentSessionsRepository, useSftpClientFactory, useSyncService } from '../../../src/core/core-context';
import { useThemeColors } from '../../../src/theme/theme-provider';
import { PrimaryButton } from '../../../src/ui/form';

type Stage = 'connecting' | 'awaiting-credentials' | 'ready' | 'error';

interface IManualCredentials {
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
  const pull = useSyncService();
  const recentRepo = useRecentSessionsRepository();
  const connectionService = useConnectionService();
  const sftpFactory = useSftpClientFactory();
  const colors = useThemeColors();
  const [host, setHost] = useState<IMobileHost | null>(null);
  const [stage, setStage] = useState<Stage>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [manualCreds, setManualCreds] = useState<IManualCredentials>({ username: '', password: '' });
  const [path, setPath] = useState('.');
  const [entries, setEntries] = useState<readonly ISftpEntry[]>([]);
  const [transfer, setTransfer] = useState<{ label: string; pct: number } | null>(null);

  const [session, setSession] = useState<IMobileSshSession | null>(null);
  const [sftp, setSftp] = useState<MobileSftpClientService | null>(null);
  // Mirrors `sftp` for a stable unmount cleanup that never disposes on intermediate renders.
  const sftpRef = useRef<MobileSftpClientService | null>(null);

  useEffect(() => {
    const sub = pull.hosts$.subscribe((hosts) => {
      setHost(hosts.find((h) => h.id === id) ?? null);
    });
    return () => sub.unsubscribe();
  }, [pull, id]);

  // The connection coordinator owns the SSH transport (deduped with the list tap). This
  // screen opens the SFTP subsystem on the live session once it is connected.
  useEffect(() => {
    const sub = connectionService.connections$.subscribe((conn) => {
      const state = conn.get(id);
      if (state == null) {
        return;
      }
      setSession(state.session);
      if (state.status === 'needs-credentials') {
        setError(null);
        setStage('awaiting-credentials');
      } else if (state.status === 'error') {
        setError(state.error);
        setStage('error');
      } else if (state.status !== 'connected') {
        // 'connected' keeps 'connecting' until the SFTP subsystem opens below.
        setStage((prev) => (prev === 'ready' ? prev : 'connecting'));
      }
    });
    void connectionService.connect(id);
    return () => sub.unsubscribe();
  }, [connectionService, id]);

  // Open the SFTP subsystem once the transport is live.
  useEffect(() => {
    if (!session || sftp) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const client = sftpFactory.create(session);
        await client.connect();
        const initial = await client.list('.');
        if (cancelled) {
          client.dispose();
          return;
        }
        sftpRef.current = client;
        setSftp(client);
        setPath('.');
        setEntries(initial);
        setStage('ready');
        void recentRepo.touch(id, 'sftp').catch(() => {});
      } catch (err) {
        if (cancelled) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to open SFTP');
        setStage('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, sftp, sftpFactory, recentRepo, id]);

  // Dispose the SFTP client and release the shared SSH transport on unmount.
  useEffect(() => {
    return () => {
      sftpRef.current?.dispose();
      connectionService.disconnect(id);
    };
  }, [connectionService, id]);

  const onConnectManual = async () => {
    if (!manualCreds.username || !manualCreds.password) {
      setError('Username and password are required');
      setStage('error');
      return;
    }
    await connectionService.connectManual(id, manualCreds);
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

  const refresh = useCallback(async () => {
    if (!sftp) {
      return;
    }
    try {
      setEntries(await sftp.list(path));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'List failed');
    }
  }, [sftp, path]);

  const pctOf = (done: bigint, total?: bigint): number =>
    total != null && total > 0n ? Number((done * 100n) / total) : 0;

  const onUpload = useCallback(async () => {
    if (!sftp) {
      return;
    }
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled || !res.assets || res.assets.length === 0) {
      return;
    }
    const asset = res.assets[0];
    if (!asset.uri.startsWith('file://')) {
      // Some Android storage providers hand back a content:// SAF URI even with
      // copyToCacheDirectory; russh needs a real filesystem path it can open.
      Alert.alert('Unsupported source', 'Pick the file from on-device storage (Files / Downloads) so it can be read directly.');
      return;
    }
    const localPath = decodeURIComponent(asset.uri.replace(/^file:\/\//, ''));
    const remote = joinPath(path, asset.name);
    setTransfer({ label: `↑ ${asset.name}`, pct: 0 });
    try {
      const handle = sftp.upload(localPath, remote, {
        onProgress: (done, total) => setTransfer({ label: `↑ ${asset.name}`, pct: pctOf(done, total) }),
      });
      await handle.done;
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setTransfer(null);
    }
  }, [sftp, path, refresh]);

  const onDownload = useCallback(async (entry: ISftpEntry) => {
    if (!sftp || entry.isDirectory) {
      return;
    }
    const dest = `${Paths.document.uri.replace(/\/+$/, '')}/${entry.filename}`;
    const localPath = decodeURIComponent(dest.replace(/^file:\/\//, ''));
    const remote = joinPath(path, entry.filename);
    setTransfer({ label: `↓ ${entry.filename}`, pct: 0 });
    try {
      const handle = sftp.download(remote, localPath, {
        onProgress: (done, total) => setTransfer({ label: `↓ ${entry.filename}`, pct: pctOf(done, total) }),
      });
      await handle.done;
      Alert.alert('Downloaded', `Saved to the app's documents folder:\n${entry.filename}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setTransfer(null);
    }
  }, [sftp, path]);

  const submitDisabled = manualCreds.username.length === 0 || manualCreds.password.length === 0;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: host ? `${host.label} • SFTP` : 'SFTP',
          headerRight: stage === 'ready'
            ? () => (
              <Pressable onPress={onUpload} hitSlop={12}>
                <Upload size={18} color={colors.accent} />
              </Pressable>
            )
            : undefined,
        }}
      />

      {stage === 'connecting' && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.accent} />
          <Text className="mt-3 text-[13px] text-content-secondary">
            {`Opening SFTP on ${host?.label ?? 'host'}…`}
          </Text>
        </View>
      )}

      {(stage === 'awaiting-credentials' || stage === 'error') && (
        <View className="p-4">
          <Text className="text-[13px] leading-[18px] text-content-secondary">
            {stage === 'error'
              ? 'Connection failed. Enter credentials manually to retry.'
              : 'No credential on file for this host. Enter manually to connect.'}
          </Text>
          <Text className="mb-1.5 mt-3 text-[12px] text-content-secondary">Username</Text>
          <TextInput
            value={manualCreds.username}
            onChangeText={(username) => setManualCreds((c) => ({ ...c, username }))}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="root"
            placeholderTextColor={colors.contentTertiary}
            className="rounded-xl border border-divider bg-field px-3 py-3 text-[16px] text-content"
          />
          <Text className="mb-1.5 mt-3 text-[12px] text-content-secondary">Password</Text>
          <TextInput
            value={manualCreds.password}
            onChangeText={(password) => setManualCreds((c) => ({ ...c, password }))}
            secureTextEntry
            autoCapitalize="none"
            placeholder="••••••••"
            placeholderTextColor={colors.contentTertiary}
            className="rounded-xl border border-divider bg-field px-3 py-3 text-[16px] text-content"
          />
          {error != null && (
            <Text className="mt-3 text-[13px] text-danger">{error}</Text>
          )}
          <View className="mt-4">
            <PrimaryButton title="Open SFTP browser" onPress={onConnectManual} disabled={submitDisabled} />
          </View>
        </View>
      )}

      {stage === 'ready' && (
        <View className="flex-1">
          <View className="flex-row items-center gap-3 border-b border-divider px-3 py-2.5">
            <Text numberOfLines={1} className="flex-1 text-[14px] text-content">
              {path}
            </Text>
            <Pressable
              onPress={onGoUp}
              className="flex-row items-center rounded-lg bg-surface-sunken px-3 py-1.5 active:opacity-70"
            >
              <ArrowUp size={14} color={colors.contentSecondary} />
              <Text className="ml-1 text-[13px] font-semibold text-content">Up</Text>
            </Pressable>
          </View>

          {transfer != null && (
            <View className="border-b border-divider bg-surface-raised px-4 py-2">
              <View className="flex-row items-center justify-between">
                <Text numberOfLines={1} className="flex-1 text-[12px] text-content">{transfer.label}</Text>
                <Text className="ml-2 text-[12px] text-accent">
                  {transfer.pct}
                  %
                </Text>
              </View>
              <View className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-sunken">
                <View className="h-1 rounded-full bg-accent" style={{ width: `${transfer.pct}%` }} />
              </View>
            </View>
          )}

          <FlashList
            data={entries}
            keyExtractor={(item) => entryKey(path, item)}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onEnter(item)}
                onLongPress={() => onDownload(item)}
                className="flex-row items-center border-b border-divider px-4 py-3 active:bg-surface-sunken"
              >
                {item.isDirectory
                  ? <FolderIcon size={18} color={colors.accent} />
                  : <FileIcon size={18} color={colors.contentTertiary} />}
                <View className="ml-3 flex-1">
                  <Text numberOfLines={1} className="text-[14px] text-content">
                    {item.filename}
                  </Text>
                  <Text className="mt-0.5 text-[12px] text-content-secondary">
                    {item.isDirectory ? 'Directory' : `${item.size.toString()} B · long-press to download`}
                  </Text>
                </View>
                {!item.isDirectory && <Download size={15} color={colors.contentTertiary} />}
              </Pressable>
            )}
            ListEmptyComponent={(
              <Text className="p-8 text-center text-[13px] text-content-secondary">
                Directory is empty.
              </Text>
            )}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
