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

import type { IHostConnectArgs } from '../../../src/ssh/auto-connect-from-vault';
import type { IMobileSshSession } from '../../../src/ssh/mobile-ssh-client.service';
import type { IMobileHost, IMobileHostFull } from '../../../src/sync/mobile-sync-pull.service';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useCoreContext, useRecentSessionsRepository, useSyncPullService } from '../../../src/core/core-context';
import { autoConnectArgsFromVault } from '../../../src/ssh/auto-connect-from-vault';
import { buildShellResumptionCommand } from '../../../src/ssh/mobile-shell-resumption';
import { MobileSshClientService } from '../../../src/ssh/mobile-ssh-client.service';
import { buildXtermHtml, xtermBridge } from '../../../src/ssh/xterm-webview-html';
import { IMobileHostRepository } from '../../../src/storage/mobile-host-repository';

type ConnectState = 'loading-host' | 'awaiting-credentials' | 'connecting' | 'connected' | 'error';

interface ManualCredentials {
  username: string;
  password: string;
}

export default function TerminalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pull = useSyncPullService();
  const coreContext = useCoreContext();
  const recentRepo = useRecentSessionsRepository();
  const hostRepo = useMemo(
    () => coreContext.core.getInjector().get(IMobileHostRepository),
    [coreContext]
  );
  const sshClient = useMemo(() => new MobileSshClientService(), []);
  const webviewRef = useRef<WebView>(null);

  const [host, setHost] = useState<IMobileHost | null>(null);
  const [state, setState] = useState<ConnectState>('loading-host');
  const [error, setError] = useState<string | null>(null);
  const [manualCreds, setManualCreds] = useState<ManualCredentials>({ username: '', password: '' });
  const [session, setSession] = useState<IMobileSshSession | null>(null);
  // startShell needs the WebView's fit-size up front — the russh wrapper has
  // no window-change, so the first PTY dimensions are also the final ones.
  const shellStartedRef = useRef(false);
  // Cache the full record (with decrypted credential) for the duration of this screen
  // so onConnect re-uses the plaintext without another SQLite read.
  const fullHostRef = useRef<IMobileHostFull | null>(null);
  // Guard against double-auto-connect when the hosts$ subscription emits more than
  // once before connecting completes.
  const autoConnectedRef = useRef(false);

  const xtermHtml = useMemo(() => buildXtermHtml(), []);

  // Subscribe to the public hosts stream for the row metadata (label, addr, port).
  useEffect(() => {
    const sub = pull.hosts$.subscribe((hosts) => {
      setHost(hosts.find((h) => h.id === id) ?? null);
    });
    return () => sub.unsubscribe();
  }, [pull, id]);

  const connect = useCallback(async (args: IHostConnectArgs) => {
    setState('connecting');
    setError(null);
    shellStartedRef.current = false;
    try {
      const next = await sshClient.connect({
        ...args,
        hostId: id,
      });
      setSession(next);
      setState('connected');
      // Land in the Recent tab. Best-effort — a failed touch must not break the
      // session that already succeeded.
      void recentRepo.touch(id, 'terminal').catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setState('error');
      autoConnectedRef.current = false;
    }
  }, [sshClient, id, recentRepo]);

  // Resolve full record with plaintext credential, then auto-connect when possible.
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
        fullHostRef.current = full;
        if (full) {
          const auto = autoConnectArgsFromVault(full);
          if (auto) {
            autoConnectedRef.current = true;
            void connect(auto);
            return;
          }
        }
        setState('awaiting-credentials');
      } catch (err) {
        if (cancelled) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to read host');
        setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [host, hostRepo, id, connect]);

  useEffect(() => {
    if (!session) {
      return;
    }
    const sub = session.shellOutput$.subscribe((chunk) => {
      const b64 = xtermBridge.toBase64(chunk);
      webviewRef.current?.injectJavaScript(`window.__termlnkTerm.write(${JSON.stringify(b64)}); true;`);
    });
    return () => sub.unsubscribe();
  }, [session]);

  useEffect(() => {
    return () => {
      if (session) {
        session.disconnect();
      }
      sshClient.dispose();
    };
  }, [session, sshClient]);

  const onConnectManual = async () => {
    if (!host || !host.addr) {
      setError('Host has no address');
      setState('error');
      return;
    }
    if (!manualCreds.username || !manualCreds.password) {
      setError('Username and password are required');
      setState('error');
      return;
    }
    await connect({
      host: host.addr,
      port: host.port ?? 22,
      username: manualCreds.username,
      password: manualCreds.password,
    });
  };

  const onWebViewSize = useCallback(
    (cols: number, rows: number) => {
      if (shellStartedRef.current || !session || !host) {
        return;
      }
      shellStartedRef.current = true;
      void (async () => {
        try {
          await session.startShell({ terminalSize: { cols, rows } });
          await session.writeToShell(
            `${buildShellResumptionCommand({ hostId: host.id }).command}\r`
          );
        } catch (err) {
          shellStartedRef.current = false;
          setError(err instanceof Error ? err.message : 'Failed to start shell');
          setState('error');
        }
      })();
    },
    [host, session]
  );

  const submitDisabled = manualCreds.username.length === 0 || manualCreds.password.length === 0;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-black"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: host ? `${host.label} • Terminal` : 'Terminal' }} />

      {state === 'loading-host' && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#61afef" />
          <Text className="mt-3 text-[13px] text-grey-fg">Loading host…</Text>
        </View>
      )}

      {state === 'connecting' && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#61afef" />
          <Text className="mt-3 text-[13px] text-grey-fg">
            Connecting to
            {' '}
            {host?.label ?? 'host'}
            …
          </Text>
        </View>
      )}

      {(state === 'awaiting-credentials' || state === 'error') && (
        <View className="p-4">
          <Text className="text-[13px] leading-[18px] text-grey-fg">
            {state === 'error'
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
            <Text className="text-[15px] font-semibold text-black">Connect</Text>
          </Pressable>
        </View>
      )}

      {state === 'connected' && (
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html: xtermHtml }}
          javaScriptEnabled
          domStorageEnabled
          className="flex-1 bg-black"
          onError={(e) => {
            const desc = e.nativeEvent.description || 'Unknown WebView error';
            setError(`WebView failed to load: ${desc}`);
            setState('error');
          }}
          onHttpError={(e) => {
            const status = e.nativeEvent.statusCode;
            const url = e.nativeEvent.url;
            setError(`WebView HTTP ${status} on ${url}`);
            setState('error');
          }}
          onMessage={(event) => {
            try {
              const msg = JSON.parse(event.nativeEvent.data) as
                | { type: 'input'; data: string }
                | { type: 'size'; cols: number; rows: number }
                | { type: 'ready' }
                | { type: 'error'; message: string; source?: string; line?: number; col?: number; stack?: string };
              if (msg.type === 'size') {
                onWebViewSize(msg.cols, msg.rows);
              } else if (msg.type === 'input' && session && shellStartedRef.current) {
                void session.writeToShell(xtermBridge.fromBase64(msg.data));
              } else if (msg.type === 'error') {
                const where = msg.source ? ` (${msg.source}:${msg.line ?? '?'}:${msg.col ?? '?'})` : '';
                setError(`Terminal viewer error: ${msg.message}${where}`);
                setState('error');
              }
              // type === 'ready' is informational; xterm is alive and waiting for size/data.
            } catch {
              // Ignore malformed bridge messages.
            }
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
}
