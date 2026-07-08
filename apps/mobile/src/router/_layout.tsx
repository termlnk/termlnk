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

import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BiometricGate } from '../components/auth/biometric-gate';
import { PreferencesBootGate } from '../components/preferences-boot-gate';
import { CoreProvider } from '../core/core-context';
import { ThemeProvider, useThemeColors } from '../theme/theme-provider';
import '../../global.css';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <CoreProvider>
          <PreferencesBootGate>
            <ThemeProvider>
              <BiometricGate>
                <StatusBar style="auto" />
                <ThemedStack />
                <PortalHost />
              </BiometricGate>
            </ThemeProvider>
          </PreferencesBootGate>
        </CoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Native header/transition colors read from the same NativeWind palette used
// by className consumers. Lives inside CoreProvider + PreferencesBootGate +
// ThemeProvider so it can call useThemeColors() (which reads the resolved mode
// from ThemeModeContext).
function ThemedStack() {
  const colors = useThemeColors();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.content,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.surface },
      }}
    >
      {/* Screens that render their own ScreenHeader opt out of the native header; others keep a themed native header until migrated. */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="hosts" options={{ headerShown: false }} />
      <Stack.Screen name="ai" options={{ headerShown: false }} />
      <Stack.Screen name="ai-chat" options={{ headerShown: false }} />
      <Stack.Screen name="ai-settings" />
      <Stack.Screen name="ai-add-provider" options={{ title: 'Add Provider' }} />
      <Stack.Screen name="ai-provider-detail" />
      <Stack.Screen name="account" options={{ headerShown: false }} />
      <Stack.Screen name="change-password" options={{ headerShown: false }} />
      <Stack.Screen name="devices" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="group/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="vault/keychain" options={{ headerShown: false }} />
      <Stack.Screen name="vault/known-hosts" options={{ headerShown: false }} />
      <Stack.Screen name="vault/logs" options={{ headerShown: false }} />
      <Stack.Screen name="vault/port-forwarding" options={{ headerShown: false }} />
      <Stack.Screen name="vault/port-forwarding-edit" options={{ headerShown: false }} />
      <Stack.Screen name="vault/snippets" options={{ headerShown: false }} />
      <Stack.Screen
        name="vault/snippet-edit"
        options={{
          presentation: 'formSheet',
          headerShown: false,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.6, 0.95] as number[],
          sheetCornerRadius: 28,
          contentStyle: { flex: 1 },
        }}
      />
      <Stack.Screen
        name="vault/snippet-package-edit"
        options={{
          presentation: 'formSheet',
          headerShown: false,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.4, 0.95] as number[],
          sheetCornerRadius: 28,
          contentStyle: { flex: 1 },
        }}
      />
      <Stack.Screen
        name="vault/snippet-package-picker"
        options={{
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.5, 0.95] as number[],
          sheetCornerRadius: 20,
          contentStyle: { flex: 1 },
        }}
      />
      <Stack.Screen name="keychain/identity" options={{ headerShown: false }} />
      <Stack.Screen name="keychain/key" options={{ headerShown: false }} />
      <Stack.Screen name="keychain/new-key" options={{ headerShown: false }} />
      <Stack.Screen name="keychain/generate-key" options={{ headerShown: false }} />
      <Stack.Screen
        name="host/edit"
        options={{
          presentation: 'formSheet',
          headerShown: false,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.5, 0.95] as number[],
          sheetCornerRadius: 28,
          contentStyle: { flex: 1 },
        }}
      />
      <Stack.Screen
        name="group-picker"
        options={{
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.6, 0.95] as number[],
          sheetCornerRadius: 20,
          contentStyle: { flex: 1 },
        }}
      />
      <Stack.Screen
        name="keychain-picker"
        options={{
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.6, 0.95] as number[],
          sheetCornerRadius: 20,
          contentStyle: { flex: 1 },
        }}
      />
      <Stack.Screen
        name="vault/port-forwarding-host-picker"
        options={{
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.6, 0.95] as number[],
          sheetCornerRadius: 20,
          contentStyle: { flex: 1 },
        }}
      />
    </Stack>
  );
}
