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

import type { IMobileSshSession } from '../../../src/ssh/mobile-ssh-client.service';
import type { IMobileHost } from '../../../src/sync/mobile-sync-pull.service';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSyncPullService } from '../../../src/core/core-context';
import { buildShellResumptionCommand } from '../../../src/ssh/mobile-shell-resumption';
import { MobileSshClientService } from '../../../src/ssh/mobile-ssh-client.service';
import { buildXtermHtml, xtermBridge } from '../../../src/ssh/xterm-webview-html';

type ConnectState = 'awaiting-credentials' | 'connecting' | 'connected' | 'error';

interface Credentials {
  password: string;
}

export default function TerminalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pull = useSyncPullService();
  const sshClient = useMemo(() => new MobileSshClientService(), []);
  const webviewRef = useRef<WebView>(null);

  const [host, setHost] = useState<IMobileHost | null>(null);
  const [state, setState] = useState<ConnectState>('awaiting-credentials');
  const [error, setError] = useState<string | null>(null);
  const [creds, setCreds] = useState<Credentials>({ password: '' });
  const [session, setSession] = useState<IMobileSshSession | null>(null);

  const xtermHtml = useMemo(() => buildXtermHtml(), []);

  useEffect(() => {
    const sub = pull.snapshot$.subscribe((snap) => {
      setHost(snap.hosts.find((h) => h.id === id) ?? null);
    });
    return () => sub.unsubscribe();
  }, [pull, id]);

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

  const onConnect = async () => {
    if (!host || !host.addr) {
      setError('Host has no address');
      setState('error');
      return;
    }
    setState('connecting');
    setError(null);
    try {
      const next = await sshClient.connect({
        host: host.addr,
        port: host.port ?? 22,
        username: '__placeholder__', // P6.6 ships with password auth; username UI lands with profiles in v1.1.
        password: creds.password,
      });
      await next.startShell();
      await next.writeToShell(buildShellResumptionCommand({ hostId: host.id }).command);
      setSession(next);
      setState('connected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setState('error');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: host ? `${host.label} • Terminal` : 'Terminal' }} />
      {state !== 'connected' && (
        <View style={styles.credentials}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={creds.password}
            onChangeText={(password) => setCreds({ password })}
            secureTextEntry
            autoCapitalize="none"
            placeholder="••••••••"
            placeholderTextColor="#6b7280"
            style={styles.input}
            editable={state === 'awaiting-credentials' || state === 'error'}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            onPress={onConnect}
            disabled={state === 'connecting' || creds.password.length === 0}
            style={({ pressed }) => [
              styles.button,
              (state === 'connecting' || creds.password.length === 0) && styles.buttonDisabled,
              pressed && { opacity: 0.85 },
            ]}
          >
            {state === 'connecting'
              ? <ActivityIndicator color="#0a0a0a" />
              : <Text style={styles.buttonLabel}>Connect</Text>}
          </Pressable>
          <Text style={styles.note}>
            v1 uses password auth only. SSH key support lands in v1.1 alongside the
            decrypted host credential pipeline.
          </Text>
        </View>
      )}
      {state === 'connected' && (
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html: xtermHtml, baseUrl: 'https://cdn.jsdelivr.net' }}
          javaScriptEnabled
          domStorageEnabled
          style={styles.webview}
          onMessage={(event) => {
            try {
              const msg = JSON.parse(event.nativeEvent.data) as { type: string; data: string };
              if (msg.type === 'input' && session) {
                void session.writeToShell(xtermBridge.fromBase64(msg.data));
              }
            } catch {
              // Ignore malformed bridge messages.
            }
          }}
        />
      )}
    </KeyboardAvoidingView>
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
  webview: { flex: 1, backgroundColor: '#0a0a0a' },
});
