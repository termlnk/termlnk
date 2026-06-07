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
import { CoreProvider } from '../src/core/core-context';
import { BiometricGate } from '../src/platform/biometric-gate';
import '../global.css';

// Base46 onedark palette — mirrors values from tailwind.config.js so the native
// header chrome (which can't read Tailwind classes directly) matches the rest
// of the app. Keep these literal here; the navigation layer is the only place
// outside JSX that needs raw hex values.
const BG = '#1e222a';
const FG = '#6f737b';

export default function RootLayout() {
  return (
    <CoreProvider>
      <BiometricGate>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: BG },
            headerTintColor: FG,
            contentStyle: { backgroundColor: BG },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </BiometricGate>
    </CoreProvider>
  );
}
