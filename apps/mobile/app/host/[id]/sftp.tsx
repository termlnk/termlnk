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
import type { IHostConnectArgs } from '../../../src/ssh/auto-connect-from-vault';
import type { IMobileSshSession } from '../../../src/ssh/mobile-ssh-client.service';
import type { IMobileHost } from '../../../src/storage/types';
import * as DocumentPicker from 'expo-document-picker';
import { Paths } from 'expo-file-system';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ArrowUp, Download, File as FileIcon, Folder as FolderIcon, Upload } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useCoreContext, useIdentityRepository, useRecentSessionsRepository, useSshKeyRepository, useSyncService } from '../../../src/core/core-context';
import { MobileSftpClientService } from '../../../src/sftp/mobile-sftp-client.service';
import { resolveHostConnectArgs } from '../../../src/ssh/auto-connect-from-vault';
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
  const pull = useSyncService();
  const coreContext = useCoreContext();
  const recentRepo = useRecentSessionsRepository();
  const hostRepo = useMemo(
    () => coreContext.core.getInjector().get(IMobileHostRepository),
    [coreContext]
  );

  const sshClient = useMemo(() => new MobileSshClientService(), []);
  const identityRepo = useIdentityRepository();
  const keyRepo = useSshKeyRepository();
  const [host, setHost] = useState<IMobileHost | null>(null);
  const [stage, setStage] = useState<Stage>('loading-host');
  const [error, setError] = useState<string | null>(null);
  const [manualCreds, setManualCreds] = useState<ManualCredentials>({ username: '', password: '' });
  const [path, setPath] = useState('.');
  const [entries, setEntries] = useState<readonly ISftpEntry[]>([]);
  const [transfer, setTransfer] = useState<{ label: string; pct: number } | null>(null);

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
      void recentRepo.touch(host.id, 'sftp').catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setStage('error');
      autoConnectedRef.current = false;
    }
  }, [sshClient, host, recentRepo]);

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
          const auto = await resolveHostConnectArgs(full, identityRepo, keyRepo);
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
  }, [host, hostRepo, id, connect, identityRepo, keyRepo]);

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
      className="flex-1 bg-black"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: host ? `${host.label} • SFTP` : 'SFTP',
          headerRight: stage === 'ready'
            ? () => (
                <Pressable onPress={onUpload} hitSlop={12}>
                  <Upload size={18} color="#61afef" />
                </Pressable>
              )
            : undefined,
        }}
      />

      {(stage === 'loading-host' || stage === 'connecting') && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#61afef" />
          <Text className="mt-3 text-[13px] text-grey-fg">
            {stage === 'loading-host'
              ? 'Loading host…'
              : `Opening SFTP on ${host?.label ?? 'host'}…`}
          </Text>
        </View>
      )}

      {(stage === 'awaiting-credentials' || stage === 'error') && (
        <View className="p-4">
          <Text className="text-[13px] leading-[18px] text-grey-fg">
            {stage === 'error'
              ? 'Connection failed. Enter credentials manually to retry.'
              : 'No credential on file for this host. Enter manually to connect.'}
          </Text>
          <Text className="mb-1.5 mt-3 text-[12px] text-grey-fg">Username</Text>
          <TextInput
            value={manualCreds.username}
            onChangeText={(username) => setManualCreds((c) => ({ ...c, username }))}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="root"
            placeholderTextColor="#42464e"
            className="rounded-lg bg-one-bg2 px-3 py-2.5 text-[15px] text-light-grey"
          />
          <Text className="mb-1.5 mt-3 text-[12px] text-grey-fg">Password</Text>
          <TextInput
            value={manualCreds.password}
            onChangeText={(password) => setManualCreds((c) => ({ ...c, password }))}
            secureTextEntry
            autoCapitalize="none"
            placeholder="••••••••"
            placeholderTextColor="#42464e"
            className="rounded-lg bg-one-bg2 px-3 py-2.5 text-[15px] text-light-grey"
          />
          {error != null && (
            <Text className="mt-3 text-[13px] text-red">{error}</Text>
          )}
          <Pressable
            onPress={onConnectManual}
            disabled={submitDisabled}
            className={`mt-4 items-center rounded-lg py-3 active:opacity-80 ${submitDisabled ? 'bg-one-bg3 opacity-50' : 'bg-blue'}`}
          >
            <Text className="text-[15px] font-semibold text-black">
              Open SFTP browser
            </Text>
          </Pressable>
        </View>
      )}

      {stage === 'ready' && (
        <View className="flex-1">
          <View className="flex-row items-center gap-3 border-b border-line px-3 py-2.5">
            <Text numberOfLines={1} className="flex-1 text-[14px] text-light-grey">
              {path}
            </Text>
            <Pressable
              onPress={onGoUp}
              className="flex-row items-center rounded-md bg-one-bg2 px-3 py-1.5 active:bg-one-bg3"
            >
              <ArrowUp size={14} color="#6f737b" />
              <Text className="ml-1 text-[13px] font-semibold text-light-grey">Up</Text>
            </Pressable>
          </View>

          {transfer != null && (
            <View className="border-b border-line bg-one-bg px-4 py-2">
              <View className="flex-row items-center justify-between">
                <Text numberOfLines={1} className="flex-1 text-[12px] text-light-grey">{transfer.label}</Text>
                <Text className="ml-2 text-[12px] text-nord-blue">{transfer.pct}%</Text>
              </View>
              <View className="mt-1.5 h-1 overflow-hidden rounded-full bg-one-bg3">
                <View className="h-1 rounded-full bg-nord-blue" style={{ width: `${transfer.pct}%` }} />
              </View>
            </View>
          )}

          <FlatList
            data={entries}
            keyExtractor={(item) => entryKey(path, item)}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onEnter(item)}
                onLongPress={() => onDownload(item)}
                className="flex-row items-center border-b border-line px-4 py-3 active:bg-one-bg"
              >
                {item.isDirectory
                  ? <FolderIcon size={18} color="#61afef" />
                  : <FileIcon size={18} color="#565c64" />}
                <View className="ml-3 flex-1">
                  <Text numberOfLines={1} className="text-[14px] text-light-grey">
                    {item.filename}
                  </Text>
                  <Text className="mt-0.5 text-[12px] text-grey-fg">
                    {item.isDirectory ? 'Directory' : `${item.size.toString()} B · long-press to download`}
                  </Text>
                </View>
                {!item.isDirectory && <Download size={15} color="#42464e" />}
              </Pressable>
            )}
            ListEmptyComponent={(
              <Text className="p-8 text-center text-[13px] text-grey-fg">
                Directory is empty.
              </Text>
            )}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
