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

import type { IMobileHost } from '@termlnk/database-mobile';
import type { IMobileSshSession, IXtermWebViewConfig } from '@termlnk/terminal-mobile';
import { buildXtermHtml, xtermBridge } from '@termlnk/terminal-mobile';
import { base46ToXterm, THEME_MAP } from '@termlnk/themes';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useConnectionService, usePreferencesService, useRecentSessionsRepository, useSyncService } from '../../../src/core/core-context';
import { AuthFailedSheet } from '../../../src/terminal/auth-failed-sheet';
import { HostKeySheet } from '../../../src/terminal/host-key-sheet';
import { TerminalAccessory } from '../../../src/terminal/terminal-accessory';
import { useSshEvent } from '../../../src/terminal/use-ssh-event';
import { useThemeColors } from '../../../src/theme/theme-provider';

type ConnectState = 'connecting' | 'awaiting-credentials' | 'connected' | 'error';

interface IManualCredentials {
  username: string;
  password: string;
}

export default function TerminalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pull = useSyncService();
  const recentRepo = useRecentSessionsRepository();
  const connectionService = useConnectionService();
  const prefsService = usePreferencesService();
  // Snapshot terminal config once for this session — the WebView HTML is built from
  // this snapshot. Live adjustments (font size, theme) are pushed via injectJavaScript.
  const [termConfig, setTermConfig] = useState<IXtermWebViewConfig | null>(null);
  // Live value shown in the theme panel stepper.
  const [displayFontSize, setDisplayFontSize] = useState(13);
  const webviewRef = useRef<WebView>(null);
  // Tracks whether the soft keyboard (xterm textarea focus) is currently raised.
  const keyboardVisibleRef = useRef(true);
  const terminalReadyRef = useRef(false);

  const [host, setHost] = useState<IMobileHost | null>(null);
  const [state, setState] = useState<ConnectState>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [manualCreds, setManualCreds] = useState<IManualCredentials>({ username: '', password: '' });
  const [session, setSession] = useState<IMobileSshSession | null>(null);
  const { hostKeyEvent, authFailedEvent, setPendingEvent } = useSshEvent(id);
  // startShell needs the WebView's fit-size up front — the russh wrapper has
  // no window-change, so the first PTY dimensions are also the final ones.
  const shellStartedRef = useRef(false);
  // Lands the host in the Recent tab once, on the first connected emission.
  const touchedRef = useRef(false);

  const colors = useThemeColors();

  const terminalBg = useMemo(
    () => termConfig?.theme?.background ?? colors.surface,
    [termConfig, colors.surface]
  );

  const xtermHtml = useMemo(() => {
    if (!termConfig) {
      return null;
    }
    return buildXtermHtml(termConfig);
  }, [termConfig]);

  useEffect(() => {
    void prefsService.ready().then(() => {
      const p = prefsService.get();
      const theme = THEME_MAP.get(p.terminalThemeName);
      const xtermTheme = theme ? base46ToXterm(theme) : undefined;
      setTermConfig({
        fontSize: p.terminalFontSize,
        fontFamily: p.terminalFontFamily,
        cursorStyle: p.terminalCursorStyle,
        cursorBlink: p.terminalCursorBlink,
        scrollback: p.terminalScrollback,
        theme: xtermTheme,
      });
      setDisplayFontSize(p.terminalFontSize);
    });
  }, [prefsService]);

  // Font-size changes persist and apply live to the running terminal.
  const onFontDelta = useCallback((delta: number) => {
    setDisplayFontSize((prev) => {
      const next = Math.min(22, Math.max(9, prev + delta));
      void prefsService.update({ terminalFontSize: next });
      webviewRef.current?.injectJavaScript(`window.__termlnkTerm && window.__termlnkTerm.setFontSize(${next}); true;`);
      return next;
    });
  }, [prefsService]);

  const onToggleKeyboard = useCallback(() => {
    const focus = !keyboardVisibleRef.current;
    keyboardVisibleRef.current = focus;
    webviewRef.current?.injectJavaScript(
      focus
        ? 'window.__termlnkTerm && window.__termlnkTerm.focus(); true;'
        : 'window.__termlnkTerm && window.__termlnkTerm.blur(); true;'
    );
  }, []);

  const onCloseSession = useCallback(() => {
    connectionService.disconnect(id);
    router.back();
  }, [connectionService, id, router]);

  const writeToTerminal = useCallback((output: string) => {
    if (!terminalReadyRef.current) {
      return;
    }
    const b64 = xtermBridge.toBase64(output);
    webviewRef.current?.injectJavaScript(`window.__termlnkTerm.write(${JSON.stringify(b64)}); true;`);
  }, []);

  const onSetThemeLive = useCallback((themeName: string) => {
    const theme = THEME_MAP.get(themeName);
    if (!theme) {
      return;
    }
    const xtermTheme = base46ToXterm(theme);
    webviewRef.current?.injectJavaScript(`window.__termlnkTerm && window.__termlnkTerm.setTheme(${JSON.stringify(xtermTheme)}); true;`);
    void prefsService.update({ terminalThemeName: themeName });
  }, [prefsService]);

  // Subscribe to the public hosts stream for the row metadata (label, addr, port).
  useEffect(() => {
    const sub = pull.hosts$.subscribe((hosts) => {
      setHost(hosts.find((h) => h.id === id) ?? null);
    });
    return () => sub.unsubscribe();
  }, [pull, id]);

  // The connection coordinator owns the SSH transport (resolve + connect, deduped with the
  // list tap). This screen attaches to the live session and drives the shell on top of it.
  useEffect(() => {
    const sub = connectionService.connections$.subscribe((map) => {
      const conn = map.get(id);
      if (conn == null) {
        return;
      }
      setSession(conn.session);
      setError(conn.error);
      switch (conn.status) {
        case 'connected':
          setState('connected');
          if (conn.session && !touchedRef.current) {
            touchedRef.current = true;
            void recentRepo.touch(id, 'terminal').catch(() => {});
          }
          break;
        case 'needs-credentials':
          setState('awaiting-credentials');
          break;
        case 'error':
          setState('error');
          break;
        default:
          setState('connecting');
      }
    });
    void connectionService.connect(id);
    return () => sub.unsubscribe();
  }, [connectionService, id, recentRepo]);

  useEffect(() => {
    if (!session) {
      return;
    }
    const sub = session.shellOutput$.subscribe((chunk) => {
      writeToTerminal(chunk);
    });
    return () => sub.unsubscribe();
  }, [session, writeToTerminal]);

  useEffect(() => {
    terminalReadyRef.current = false;
  }, [xtermHtml]);

  const onConnectManual = async () => {
    if (!manualCreds.username || !manualCreds.password) {
      setError('Username and password are required');
      setState('error');
      return;
    }
    await connectionService.connectManual(id, manualCreds);
  };

  const onWebViewSize = useCallback(
    (cols: number, rows: number) => {
      if (shellStartedRef.current || !session) {
        return;
      }
      shellStartedRef.current = true;
      void (async () => {
        try {
          await session.startShell({ terminalSize: { cols, rows } });
        } catch (err) {
          shellStartedRef.current = false;
          setError(err instanceof Error ? err.message : 'Failed to start shell');
          setState('error');
        }
      })();
    },
    [session, id]
  );

  const submitDisabled = manualCreds.username.length === 0 || manualCreds.password.length === 0;

  return (
    <KeyboardAvoidingView
      className="flex-1"
      style={{ backgroundColor: terminalBg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View style={{ height: insets.top, backgroundColor: terminalBg }} />

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

      {state === 'connected' && xtermHtml != null && (
        <>
          <WebView
            ref={webviewRef}
            originWhitelist={['*']}
            source={{ html: xtermHtml }}
            javaScriptEnabled
            domStorageEnabled
            keyboardDisplayRequiresUserAction={false}
            className="flex-1"
            style={{ backgroundColor: terminalBg }}
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
                if (msg.type === 'ready') {
                  terminalReadyRef.current = true;
                  if (session?.shellTranscript) {
                    writeToTerminal(session.shellTranscript);
                  }
                } else if (msg.type === 'size') {
                  onWebViewSize(msg.cols, msg.rows);
                } else if (msg.type === 'input' && session && shellStartedRef.current) {
                  void session.writeToShell(xtermBridge.fromBase64(msg.data));
                } else if (msg.type === 'error') {
                  const where = msg.source ? ` (${msg.source}:${msg.line ?? '?'}:${msg.col ?? '?'})` : '';
                  setError(`Terminal viewer error: ${msg.message}${where}`);
                  setState('error');
                }
              } catch {
                // Ignore malformed bridge messages.
              }
            }}
          />
          {session != null && (
            <TerminalAccessory
              hostLabel={host?.label ?? 'host'}
              onKey={(seq) => {
                if (shellStartedRef.current) {
                  void session.writeToShell(seq).catch(() => {});
                }
              }}
              onBack={() => {
                router.back();
              }}
              onClose={onCloseSession}
              onToggleKeyboard={onToggleKeyboard}
              fontSize={displayFontSize}
              onFontDelta={onFontDelta}
              onSetThemeLive={onSetThemeLive}
            />
          )}
        </>
      )}

      <HostKeySheet event={hostKeyEvent} onDismiss={() => setPendingEvent(null)} />
      <AuthFailedSheet event={authFailedEvent} onDismiss={() => setPendingEvent(null)} />
    </KeyboardAvoidingView>
  );
}
