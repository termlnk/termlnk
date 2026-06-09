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

import { Stack } from 'expo-router';

import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BiometricGate } from '../src/components/biometric-gate';
import { CoreProvider } from '../src/core/core-context';
import { ThemeProvider } from '../src/theme/theme-provider';
import '../global.css';

// Screen options cannot read Tailwind classes, so the native header/transition
// colors still need raw hex. Keep these in sync with the `surface`/`content`
// tokens in global.css / theme-provider.ts.
const SURFACE_DARK = '#1e222a';
const SURFACE_LIGHT = '#eceef0';
const CONTENT_DARK = '#d7dae0';
const CONTENT_LIGHT = '#10233f';

export default function RootLayout() {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const surface = dark ? SURFACE_DARK : SURFACE_LIGHT;
  const content = dark ? CONTENT_DARK : CONTENT_LIGHT;
  return (
    <SafeAreaProvider>
      <CoreProvider>
        <ThemeProvider>
          <BiometricGate>
            <StatusBar style="auto" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: surface },
                headerTintColor: content,
                headerShadowVisible: false,
                contentStyle: { backgroundColor: surface },
              }}
            >
              {/* Screens that render their own ScreenHeader opt out of the native header; others keep a themed native header until migrated. */}
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="hosts" options={{ headerShown: false }} />
              <Stack.Screen name="ai" options={{ headerShown: false }} />
              <Stack.Screen name="settings" options={{ headerShown: false }} />
              <Stack.Screen name="group/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="vault/keychain" options={{ headerShown: false }} />
              <Stack.Screen name="vault/known-hosts" options={{ headerShown: false }} />
              <Stack.Screen name="vault/logs" options={{ headerShown: false }} />
              <Stack.Screen name="vault/port-forwarding" options={{ headerShown: false }} />
              <Stack.Screen name="vault/snippets" options={{ headerShown: false }} />
              <Stack.Screen name="host/edit" options={{ headerShown: false, presentation: 'modal' }} />
              <Stack.Screen name="group-picker" options={{ headerShown: false, presentation: 'modal' }} />
            </Stack>
          </BiometricGate>
        </ThemeProvider>
      </CoreProvider>
    </SafeAreaProvider>
  );
}
